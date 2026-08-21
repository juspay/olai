/**
 * The conversation, as rows.
 *
 * {@link ./agent.ts} says what the agent DID; this says what the panel shows.
 * Keeping the two apart is what lets the transcript have rules of its own — an
 * agent's chunks accumulate into one entry, a tool call is updated in place by
 * its id, a replay replaces everything rather than appending to it — without
 * any of them leaking into the protocol layer.
 *
 * It is a keyed, ordered set rather than a list, because that is what the wire
 * member is: a collection served with batched deltas, so an entry that changes
 * is one upsert on its own key and a late-joining tab gets the whole thing in
 * one frame. The `seq` on each entry is what keeps the ORDER independent of the
 * delivery — arrival order and conversation order are the same thing until a
 * session is replaced, and an explicit sequence means the panel never has to
 * know the difference.
 *
 * ONE thing is open at a time, and {@link Transcript.open} is the whole of that
 * fact: an entry's `streaming` flag is DERIVED from it on every write rather
 * than set beside it. The two used to be kept in step by hand, and the bug that
 * hid there is the one this shape makes unrepresentable — an agent that spoke,
 * then called a tool, left a paragraph marked as still growing until the end of
 * the turn, because the tool frame cleared the pointer and nobody re-published
 * the paragraph.
 *
 * WHAT A TURN LEAVES BEHIND is recorded the same way, for a sharper version of
 * the same reason. A call the wire still calls running when its turn ends will
 * never be reported on — the agent that would have reported has finished, or
 * died — and `stranded` is that, derived off a set this class keeps rather than
 * written onto the row. It is what lets the panel's live faces be functions of
 * the ROW: "is a turn in flight" is a fact about the CONVERSATION and answers
 * the wrong question, because a dead agent's rows are deliberately left where
 * they are, so sending again would light every abandoned call back up at once.
 * It is said at BOTH ends of a turn ({@link Transcript.begins},
 * {@link Transcript.settle}), which is what makes "nothing from a previous turn
 * is unstranded under this one" a property rather than a path somebody has to
 * have remembered.
 *
 * Everything here is synchronous and in memory. The transcript is not
 * persisted: the agent's own session is the persistence (that is the whole
 * point of adopting one on boot), and a second copy would be a second thing to
 * be wrong.
 */

import { isRunningStatus } from "@olai/surface"

import type {
  AskField,
  AskOutcome,
  ChatEntry,
  FileDiff,
  OpFailure,
  Spawned,
  Wrote,
} from "@olai/surface"

export interface Change {
  readonly upserts: ReadonlyArray<readonly [string, ChatEntry]>
  readonly removes: ReadonlyArray<string>
}

const EMPTY: Change = { upserts: [], removes: [] }

/**
 * An entry without the fields `#put` DERIVES, ready to be written back.
 *
 * `streaming` is why this exists and why it is one function: a spread of the
 * old entry carries the flag straight past the derivation that is supposed to
 * decide it, which is the bug this class's header says its shape makes
 * unrepresentable. It stopped being one function the moment a second writer
 * needed it — and the two lists had already drifted apart by a field, which is
 * exactly how the header's claim would have quietly stopped being true.
 */
const contentOf = (
  entry: ChatEntry,
): RowContent => {
  const {
    id: _id,
    seq: _seq,
    since: _since,
    streaming: _streaming,
    stranded: _stranded,
    ...content
  } = entry
  return content
}

/**
 * A row's CONTENT: everything about it that a caller decides.
 *
 * The fields taken off are the ones {@link Transcript} DERIVES — which key the
 * row is, where it sits, when it arrived, whether it is still growing, and
 * whether the turn that announced it has ended without it coming back.
 * Naming them once, here, is what makes them unsettable: every door into this
 * class takes this rather than a `Partial<ChatEntry>`, so a caller cannot hand
 * in a `seq` or a `since` for the writer to have to ignore, and a fifth derived
 * field inherits the rule instead of needing each door to be told about it.
 *
 * Exported because two of those doors are public and their argument has to be
 * nameable from outside.
 */
export type RowContent = Omit<
  ChatEntry,
  "id" | "seq" | "since" | "streaming" | "stranded"
>

/** What a tool call is filed under. Spelled ONCE: the row a call writes and
 *  the row it names as the agent that made it are the same kind of key, and
 *  two literals for one scheme is one of them being missed the day the scheme
 *  moves. */
const toolKey = (id: string): string => `tool:${id}`

/** Two changes as one. Closing the open entry and writing the next one are two
 *  upserts a subscriber should see in the same frame. */
const both = (first: Change, second: Change): Change => ({
  upserts: [...first.upserts, ...second.upserts],
  removes: [...first.removes, ...second.removes],
})

export class Transcript {
  #entries = new Map<string, ChatEntry>()
  #seq = 0
  /** The agent entry currently being streamed into, if any — the ONE place
   *  "still growing" is recorded. Chunks accumulate into it rather than each
   *  becoming a row: what a reader wants is one paragraph growing, not forty. */
  #open: string | null = null
  #minted = 0
  /**
   * What it would take to send a REFUSED row again, by that row's key.
   *
   * HERE, beside the rows, rather than in the caller that knows about agents —
   * because it is half of one fact and the other half is a field on the entry.
   * A row offering a retry with no prompt behind it draws a button that
   * refuses; a prompt with no row is a message nobody can see. Kept together,
   * neither is constructible: {@link refused} writes both, {@link sent} drops
   * both, and {@link clear} — the one place a conversation ends — takes both
   * with it instead of a caller having to remember the second.
   *
   * ONLY refused rows are in here, which is the map carrying the design rather
   * than reminding somebody of it: a row whose delivery went `unanswered` is
   * one the agent may already have, so there is no honest retry to offer and
   * nothing to keep for one ({@link unanswered}).
   *
   * The prompt is OPAQUE to this file: it is the agent's own string, with tmp
   * paths in it, and nothing here reads it or publishes it. The transcript
   * stores it and hands it back.
   */
  #undelivered = new Map<string, string>()
  /**
   * What time it is, for {@link ChatEntry.since}.
   *
   * HANDED IN, with the real clock as the default, for the reason every other
   * rule in this file is a value: the transcript is a data structure with no
   * agent, no socket and no browser under it, and a stamp read off `Date.now`
   * directly would be the one fact here that could only be asserted by
   * comparing it with itself. It is the arrangement the panel's own faces have
   * with the state they cannot see (`chat/spawn.ts`'s `live`).
   *
   * MILLISECONDS, stamped as a UTC instant — deliberately not `@olai/ops`'
   * `Context.now`, which is the other injected clock in this repo and answers
   * with the local-with-offset text the FORMAT stores. The two spellings are
   * about two different things and the divergence is the point: that one mints
   * a date a person will read in their own file, this one mints a machine
   * instant a browser subtracts from its own clock. A date in a file has a
   * timezone because the person does; an instant does not.
   */
  /**
   * The calls a TURN left behind, by key — the ONE place "its turn ended and it
   * never came back" is recorded, with {@link ChatEntry.stranded} derived from
   * it on every write exactly as `streaming` is derived from {@link #open}.
   *
   * Set beside the rows rather than written onto them for that flag's own
   * reason, and it is the sharper one here: a row is re-published by half a
   * dozen paths that spread it as it stands, so a hand-set field would be
   * carried straight past the decision that is supposed to make it — and this
   * one, unlike `streaming`, is a claim that gets LOUDER the longer it is
   * wrong, because the face it feeds is a clock.
   *
   * A key leaves the set the moment its call is reported on again
   * ({@link tool}), which is the only thing that could make the claim untrue.
   */
  #stranded = new Set<string>()
  readonly #now: () => number

  constructor(now: () => number = Date.now) {
    this.#now = now
  }

  entries(): ReadonlyMap<string, ChatEntry> {
    return this.#entries
  }

  /** Everything, gone — a new session, or one being loaded. The removes are
   *  reported so a subscriber's own copy empties rather than accumulating two
   *  conversations. */
  clear(): Change {
    const removes = [...this.#entries.keys()]
    this.#entries.clear()
    this.#undelivered.clear()
    this.#stranded.clear()
    this.#open = null
    this.#seq = 0
    return { upserts: [], removes }
  }

  /** A row that stands on its own. */
  add(
    kind: ChatEntry["kind"],
    text: string,
    extra: Partial<RowContent> = {},
  ): Change {
    return this.#row(kind, text, extra).change
  }

  /**
   * What a person said — a row like any other, ANSWERING WITH ITS KEY.
   *
   * The one caller that has to keep a key. Every other entry is written and
   * forgotten, but a user message can turn out to be undeliverable after it
   * has been drawn ({@link refused}), and a retry that lands has to find the
   * same row again — so the key comes back here rather than being fished out
   * of the change or re-derived from a counter kept somewhere else.
   *
   * It is the same door as {@link add} with the key kept ({@link #row}), and
   * not a second way to write a row: `add("user", …)` is still what a REPLAY
   * uses, and two minting paths would be two answers to "how is a row
   * written" for the one kind that has both.
   */
  user(text: string, extra: Partial<RowContent> = {}): {
    readonly key: string
    readonly change: Change
  } {
    return this.#row("user", text, extra)
  }

  /**
   * That message CERTAINLY never reached the agent, and here is what it would
   * take to send it again.
   *
   * The row does not move and nothing is minted: what a person typed stays
   * exactly where they typed it, in the conversation, with a mark saying it is
   * still theirs to send.
   *
   * A row that is not there any more — the session was replaced under it —
   * changes nothing rather than minting one, which is {@link settleAsk}'s rule
   * and for its reason. The prompt is not kept either: there is no row for it
   * to belong to.
   */
  refused(key: string, prompt: string): Change {
    if (!this.#entries.has(key)) return EMPTY
    this.#undelivered.set(key, prompt)
    return this.#mark(key, "refused")
  }

  /**
   * NOTHING CAME BACK about that message, and that is all anybody can say.
   *
   * The other half of {@link refused}, and it takes no prompt — deliberately.
   * An agent that went quiet may have the message already, so a retry would be
   * a duplicate offered to somebody with no way to tell, and the way to make
   * that unofferable is to keep nothing to offer. The words are still on the
   * row, which is the promise this whole mechanism exists to keep; what is not
   * there is a button.
   */
  unanswered(key: string): Change {
    if (!this.#entries.has(key)) return EMPTY
    // A prompt kept from an EARLIER failure of the same row goes with it: a
    // retry that went out and then went quiet leaves a row nothing may offer
    // to send again, and the offer lives in this map.
    this.#undelivered.delete(key)
    return this.#mark(key, "unanswered")
  }

  /** ... and it went after all. The mark comes off and the prompt is let go: a
   *  row must not go on advertising a failure that has stopped being true, and
   *  a prompt kept past its row's mark is a retry nothing can ask for. */
  sent(key: string): Change {
    this.#undelivered.delete(key)
    return this.#mark(key, null)
  }

  /** What it would take to send that row again, or `null` when there is no
   *  honest retry to offer — it went, or nothing ever answered about it. The
   *  prompt the agent refused, verbatim: never rebuilt from the row, which
   *  carries its pictures by name where the prompt carries their paths. */
  undelivered(key: string): string | null {
    return this.#undelivered.get(key) ?? null
  }

  /** The `delivery` field, said or unsaid, without minting a row for a key
   *  that has gone. Private because the field never moves without the prompt
   *  map beside it — which is the whole reason both live here. */
  #mark(key: string, delivery: ChatEntry["delivery"] | null): Change {
    const current = this.#entries.get(key)
    if (current === undefined) return EMPTY
    // `delivery` comes off along with the derived fields, for the same reason
    // `contentOf` takes those: this line is what DECIDES it, and a spread of
    // the old entry would carry the previous answer past the decision.
    const { delivery: _delivery, ...content } = contentOf(current)
    return this.#put(key, delivery === null ? content : { ...content, delivery })
  }

  /** One chunk of the agent's prose. Appends to the entry already open, or
   *  opens one. */
  say(text: string): Change {
    if (this.#open === null) this.#open = this.#next("agent")
    const key = this.#open
    return this.#put(key, {
      kind: "agent",
      text: `${this.#entries.get(key)?.text ?? ""}${text}`,
    })
  }

  /**
   * A turn is STARTING.
   *
   * It writes no row — what a person typed is already one — and does exactly
   * one thing: nothing a previous turn left running may still look like work in
   * progress under this one. {@link settle} has normally said that already, at
   * the honest moment, so this is usually a no-op; it is here because the bug
   * it forecloses is specifically about the SECOND turn. A dead agent's rows
   * are deliberately not cleared, so sending again puts a live turn over a
   * transcript full of calls that will never report — and any face that asked
   * the CONVERSATION whether something was running would light every one of
   * them up at once. Saying it at both ends of a turn is what makes "no row
   * from a previous turn is unstranded under this one" a property rather than a
   * path somebody has to have remembered.
   */
  begins(): Change {
    return this.#strand()
  }

  /** The turn ended: whatever was streaming has stopped, and so has anything
   *  the agent announced and never reported back on. */
  settle(): Change {
    return both(this.#close(), this.#strand())
  }

  /**
   * Mark every call this turn is leaving behind.
   *
   * A call the wire still calls running when its turn is over is a call that
   * will never be reported on: the agent that would have reported has finished,
   * or died. Its STATUS is left exactly as it came — `pending` is the agent's
   * own word and the row is the record of what it said — and what is added is
   * olai's own observation about its own conversation, which is the only part
   * of this anybody here is entitled to.
   *
   * A row already marked is skipped rather than re-published: this runs at both
   * ends of every turn, and a frame per idle call per turn would be a
   * conversation republishing its whole history to say nothing.
   */
  #strand(): Change {
    let change: Change = EMPTY
    for (const [key, entry] of this.#entries) {
      if (entry.kind !== "tool" || this.#stranded.has(key)) continue
      if (!isRunningStatus(entry.status)) continue
      this.#stranded.add(key)
      change = both(change, this.#put(key, contentOf(entry)))
    }
    return change
  }

  /**
   * A tool call, announced or moved. Keyed by the agent's own call id, so the
   * second report of a call is the same row with a new status rather than a
   * second row — which is the whole reason the transcript is keyed.
   *
   * Fields that arrive `undefined` mean "unchanged", not "cleared": the
   * protocol reports a call twice and the second report carries only what
   * moved.
   *
   * A tool frame also CLOSES the open prose entry: the agent said something,
   * then did something, and the next thing it says is a new paragraph.
   */
  tool(
    id: string,
    move: {
      readonly title?: string | undefined
      readonly status?: ChatEntry["status"] | undefined
      readonly detail?: string | undefined
      readonly progress?: string | undefined
      readonly diffs?: ReadonlyArray<FileDiff> | undefined
      readonly wrote?: Wrote | undefined
      readonly locations?: ReadonlyArray<string> | undefined
      readonly parent?: string | undefined
      readonly spawned?: Spawned | undefined
    },
  ): Change {
    const key = toolKey(id)
    const current = this.#entries.get(key)
    // ANYTHING HERE KNOWING. The mark means "as far as this end can tell, that
    // one never came back", and a report about it is this end being told
    // otherwise — so it comes off, and `#put` below re-derives the field from
    // the set rather than from whatever the row was carrying.
    this.#stranded.delete(key)
    const detail = move.detail ?? current?.detail
    // The protocol's own rule, and the reason neither of these accumulates: a
    // report carries the call's content and locations AS THEY STAND, so
    // appending would print the first half of a long output twice.
    const progress = move.progress ?? current?.progress
    // The same rule for what the call CHANGED, and it is what keeps a diff on
    // screen: the announcement carries the blocks, the completion that follows
    // carries only a status, and a row that read that as "no diffs now" would
    // drop the change at the moment the call finished.
    const diffs = move.diffs ?? current?.diffs
    const wrote = move.wrote ?? current?.wrote
    const locations = move.locations ?? current?.locations
    // WHICH agent made this call, stored as THIS COLLECTION'S OWN KEY rather
    // than as the id it arrived as. A row is what a reader of this field wants
    // — the panel draws a subagent's call in a lane and names the lane after
    // the Agent frame above it — and two spellings, an id on the wire and a
    // key on screen, would be a mapping to keep in step for nothing. It is the
    // rule `ask` rows already follow one field down, in the other direction.
    //
    // Sticky like everything else here, and for a sharper reason than most:
    // the adapter stamps the attribution on a subagent's announcement and on
    // most of what follows, but a completion carrying only a status and a
    // parent-less `_meta` is a shape it has — and a row that read that as "no
    // agent now" would step out of its lane at the moment the call finished.
    const parent = move.parent === undefined ? current?.parent : toolKey(move.parent)
    // ... and what this call STARTED, which is the one field here that is
    // sticky a level DOWN as well as at the top. The fact arrives split across
    // frames because the ARGUMENTS DO: the adapter announces the call as the
    // tool use starts, refines it once they have finished parsing, and sends a
    // frame with no `rawInput` at all when the input would not serialize.
    // Every one of those is honestly a spawn and some of them honestly name no
    // kind — so a later report that said only "this is a spawn" would take
    // back a kind an earlier frame already gave.
    //
    // A SPREAD, so the rule is the same one word deeper rather than a second
    // rule: an absent field is "unchanged" inside this object exactly as an
    // absent `move` is unchanged outside it, and a field added to `Spawned`
    // later inherits that instead of needing a line of its own here to stop
    // being taken back off the row.
    const spawned = move.spawned === undefined
      ? current?.spawned
      : { ...current?.spawned, ...move.spawned }
    return both(
      this.#close(),
      this.#put(key, {
        kind: "tool",
        text: move.title ?? current?.text ?? id,
        status: move.status ?? current?.status ?? "pending",
        ...(detail === undefined ? {} : { detail }),
        ...(progress === undefined ? {} : { progress }),
        ...(diffs === undefined ? {} : { diffs }),
        ...(wrote === undefined ? {} : { wrote }),
        ...(locations === undefined ? {} : { locations }),
        ...(parent === undefined ? {} : { parent }),
        ...(spawned === undefined ? {} : { spawned }),
      }),
    )
  }

  /**
   * A question the agent asked, as a row that can be answered.
   *
   * Keyed by the ask's own id for the same reason a tool call is keyed by its
   * call id: the row is written twice — once pending, once with what was
   * chosen — and the second write must be the same row moving rather than a
   * second one appearing underneath the first.
   *
   * The id IS the key, rather than a key derived from it, and that is the one
   * place a row's key is load-bearing outside this file. A question is the only
   * entry a browser talks BACK about: it draws the row, somebody fills it in,
   * and the answer names it. Two spellings — a key on screen and an id on the
   * wire — would be a mapping to keep in step for nothing, so {@link
   * ./agent.ts} mints ids in this collection's own key shape (`ask:1`) and the
   * row is stored under exactly what it was given.
   *
   * It closes the open prose entry too. The agent said something and then
   * stopped to ask, so whatever it says next is a new paragraph.
   *
   * WHO IS ASKING travels the same way a tool call's does — as the `Agent`
   * frame's own key, minted from the id the question arrived attributed with.
   * A question is a row of the conversation like any other, so it belongs in
   * the lane the agent that asked it is drawn in; a form drawn in the main
   * column while a subagent waits on it is the panel saying the main agent
   * asked, and saying it at the one moment a person is about to decide
   * something. It also BREAKS THE RUN — a row with no lane between two of a
   * subagent's own is a stretch ending and another one opening, so the lane
   * re-introduces itself underneath the form. That is the visible half of the
   * same bug, and it goes with the same field.
   */
  ask(
    id: string,
    message: string,
    fields: ReadonlyArray<AskField>,
    // REQUIRED, and `undefined` for the main agent's own — not optional, which
    // would spell what `tool`'s `move.parent` spells forty lines up while
    // meaning the opposite. There, absent is "this report said nothing"; here
    // there is nothing to say later, because a question is asked once by one
    // agent. A caller that could leave it off is a caller that can mint an
    // unattributed form without a type error, which is the bug this argument
    // exists to close ({@link ./events.ts} draws the same line one layer up).
    parent: string | undefined,
  ): Change {
    return both(
      this.#close(),
      this.#put(id, {
        kind: "ask",
        text: message,
        ask: { fields, outcome: null },
        ...(parent === undefined ? {} : { parent: toolKey(parent) }),
      }),
    )
  }

  /** ... and it stopped waiting. The row stays where it is, with what happened
   *  written into it: a question and its answer are one thing that happened,
   *  and a transcript that dropped the form would leave an answer with nothing
   *  above it saying what was asked. */
  settleAsk(id: string, outcome: AskOutcome): Change {
    const current = this.#entries.get(id)
    // A session replaced under a pending question empties the transcript before
    // the withdrawal reaches us; there is nothing left to settle, and minting a
    // row here would put a dead question into a fresh conversation.
    if (current?.ask === undefined) return EMPTY
    // THE ROW AS IT STANDS, with the outcome written into it — rather than
    // three of its fields named again here. This used to be the second, and
    // the day an ask row gained a field it did not name (`parent`, whose whole
    // point is that a subagent's form says whose it is) the answer would have
    // been drawn under the wrong agent's name at the moment it became the
    // record of a decision. `contentOf` is the file's own answer to exactly
    // that — its header says so about the writer that split off before this
    // one — so the class is unrepresentable rather than documented.
    return this.#put(id, {
      ...contentOf(current),
      ask: { fields: current.ask.fields, outcome },
    })
  }

  /** A write the ops layer refused. Its own kind, because the panel draws the
   *  structured detail rather than the sentence. */
  refuse(text: string, failure: OpFailure): Change {
    return this.add("refusal", text, { refusal: failure })
  }

  /** Stop streaming into whatever is open, and re-publish it without the flag.
   *  Every path that ends a paragraph goes through here, which is what keeps
   *  `#open` and the published `streaming` from disagreeing. */
  #close(): Change {
    const key = this.#open
    this.#open = null
    if (key === null) return EMPTY
    const current = this.#entries.get(key)
    if (current === undefined) return EMPTY
    return this.#put(key, contentOf(current))
  }

  /** Mint a row and answer with BOTH its key and the change, which is the one
   *  shape every writer here needs some part of: {@link add} takes the change
   *  and drops the key, {@link user} keeps both. One place knows how a row is
   *  written, so a `user` row a person typed and a `user` row a replay wrote
   *  cannot come out differently. */
  #row(kind: ChatEntry["kind"], text: string, extra: Partial<RowContent>): {
    readonly key: string
    readonly change: Change
  } {
    const key = this.#next(kind)
    return {
      key,
      change: both(this.#close(), this.#put(key, { kind, text, ...extra })),
    }
  }

  #next(kind: string): string {
    return `${kind}:${++this.#minted}`
  }

  /** Write one entry and answer with the change. `streaming` is DERIVED here —
   *  an entry is growing exactly while it is the open one — so no caller can
   *  set it, and none can forget to.
   *
   *  So is `since`, and it is derived the way `seq` is: taken off the row that
   *  is already there, minted only for one that is not. A tool call reports
   *  itself several times and every report after the first comes through here,
   *  so re-stamping would reset a duration at each frame — which is exactly the
   *  frames a long call sends while somebody is watching it.
   *
   *  And so is `stranded`, off {@link #stranded} the way `streaming` comes off
   *  {@link #open}: half a dozen paths re-publish a row by spreading it as it
   *  stands, and a hand-set flag would ride straight past the decision that is
   *  supposed to make it. */
  #put(
    key: string,
    entry: RowContent,
  ): Change {
    const existing = this.#entries.get(key)
    const next: ChatEntry = {
      ...entry,
      id: key,
      seq: existing?.seq ?? this.#seq++,
      since: existing?.since ?? new Date(this.#now()).toISOString(),
      ...(key === this.#open ? { streaming: true as const } : {}),
      ...(this.#stranded.has(key) ? { stranded: true as const } : {}),
    }
    this.#entries.set(key, next)
    return { upserts: [[key, next]], removes: [] }
  }
}
