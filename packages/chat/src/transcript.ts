/**
 * The conversation, as rows.
 *
 * {@link ./agent.ts} says what the agent DID; this says what the panel shows.
 * Keeping the two apart is what lets the transcript have rules of its own —
 * chunks accumulate into one entry, a tool call is updated in place by its id,
 * a replay replaces everything rather than appending to it — without any of
 * them leaking into the protocol layer.
 *
 * THREE of those rules are about an agent repeating itself, and they are here
 * rather than in the protocol layer because they are about what a READER can
 * follow rather than about what the wire may carry. A message's chunks
 * accumulate whoever said them, because a replay is where a PERSON's words
 * arrive in pieces ({@link Transcript.userSaid}). A call's NAME is picked at the
 * first frame that carries a title and no later one moves it
 * ({@link Transcript.tool}), because a title is a display string an agent may
 * rewrite mid-call. And a frame that says nothing the row does not already say
 * changes nothing at all — no upsert, and no mark taken back off.
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

import { isDeepStrictEqual } from "node:util"

import { isRunningStatus, isTaskOut } from "@olai/surface"

import type {
  Armed,
  AskField,
  AskOutcome,
  ChatEntry,
  Delivery,
  FileDiff,
  OpFailure,
  Saying,
  Spawned,
  ToolEntry,
  ToolStatus,
  Wrote,
} from "@olai/surface"

export interface Change {
  readonly upserts: ReadonlyArray<readonly [string, ChatEntry]>
  readonly removes: ReadonlyArray<string>
  /**
   * TEXT ADDED TO A ROW THAT IS ALREADY THERE — what a chunk of a streaming
   * answer is, said as the thing it is rather than as the row it grew.
   *
   * The upserts above carry rows WHOLE, which is what a row is and what a late
   * joiner has to be handed. A streaming answer is not a sequence of rows: it
   * is one row and six hundred pieces, and publishing the whole of it once per
   * piece puts the sum of its prefixes on the wire — quadratic in the length
   * of the answer, and the defect this field exists to be the absence of
   * (`transcript-stream-quadratic`; {@link @olai/surface}'s `Saying` carries
   * the measurement).
   *
   * INTENT, not delivery. What is here is the fact — this text belongs at that
   * offset of that row — and nothing about keys, frames or clocks. Who turns it
   * into wire is {@link ./cadence.ts}, which is also the one thing that knows a
   * row's true text is HERE all along: every whole upsert this class publishes
   * carries the row complete, appends and all, so a row always supersedes its
   * own pieces and nothing has to be reassembled to be right.
   */
  readonly appends: ReadonlyArray<Saying>
}

const EMPTY: Change = { upserts: [], removes: [], appends: [] }

/**
 * Whether a change says anything at all.
 *
 * HERE, beside the type, because it is a fact about a `Change` and the day the
 * type grew a third thing to carry is exactly the day a caller asking about
 * two of them stopped being right — which is what happened: a guard that asked
 * only about rows dropped every chunk of every streaming answer, and the
 * paragraph appeared whole when the turn ended. One reader of one shape rather
 * than a list of fields re-spelled wherever somebody publishes.
 */
export const says = (change: Change): boolean =>
  change.upserts.length > 0 || change.removes.length > 0 || change.appends.length > 0

/**
 * Whether a change speaks for any ROW — as against carrying only text added to
 * one.
 *
 * The other half of {@link says}, and here for its reason: two of a `Change`'s
 * three fields are the ones that name rows, and a caller spelling that
 * partition itself is a caller the next field misroutes. It is what
 * {@link ./cadence.ts} asks to decide whether a row has superseded the pieces of
 * itself — a question about rows, so it is asked in the rows' own words.
 */
export const movesRows = (change: Change): boolean =>
  change.upserts.length > 0 || change.removes.length > 0

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
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

const contentOf = <E extends ChatEntry>(entry: E): DistributiveOmit<
  E,
  "id" | "seq" | "since" | "streaming" | "stranded"
> => {
  switch (entry.kind) {
    case "agent": {
      const { id: _id, seq: _seq, since: _since, streaming: _streaming, ...content } =
        entry
      return content as DistributiveOmit<E, "id" | "seq" | "since" | "streaming" | "stranded">
    }
    case "tool": {
      const { id: _id, seq: _seq, since: _since, stranded: _stranded, ...content } =
        entry
      return content as DistributiveOmit<E, "id" | "seq" | "since" | "streaming" | "stranded">
    }
    default: {
      const { id: _id, seq: _seq, since: _since, ...content } = entry
      return content as DistributiveOmit<E, "id" | "seq" | "since" | "streaming" | "stranded">
    }
  }
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
export type RowContent = DistributiveOmit<
  ChatEntry,
  "id" | "seq" | "since" | "streaming" | "stranded"
>

/** A patch onto one kind's content. Correlated with the `kind` argument so
 *  `{ refusal }` is legal for a refusal row and a type error for a user row —
 *  a union of partials would accept either at every door. */
type RowPatch<K extends ChatEntry["kind"]> = Partial<Extract<RowContent, { kind: K }>>

/** The writer's derived fields, applied onto already-kind-correct content.
 *
 *  A function rather than a spread in `#put`, so `streaming` cannot land on a
 *  tool row and `stranded` cannot land on a user row — the two flags are
 *  arguments the matching arm accepts, not keys sprinkled onto every kind. */
const minted = (
  entry: RowContent,
  derived: { readonly id: string; readonly seq: number; readonly since: string },
  streaming: boolean,
  stranded: boolean,
): ChatEntry => {
  switch (entry.kind) {
    case "agent":
      return streaming
        ? { ...entry, ...derived, streaming: true as const }
        : { ...entry, ...derived }
    case "tool":
      return stranded
        ? { ...entry, ...derived, stranded: true as const }
        : { ...entry, ...derived }
    default:
      return { ...entry, ...derived }
  }
}

/** What a tool call is filed under. Spelled ONCE: the row a call writes and
 *  the row it names as the agent that made it are the same kind of key, and
 *  two literals for one scheme is one of them being missed the day the scheme
 *  moves. */
/** WHAT A DEATH SAYS when the harness sent no sentence with it.
 *
 * The harness's own summary is what a reader is owed — it names the task and
 * carries a background shell's exit code — and this is the honest thing to say
 * when the ending arrived without one: the task, by the name it was armed with,
 * and the word the harness ended it with. Never a word of ours: `stopped` and
 * `failed` are the harness's own, and a monitor somebody stopped did not fail.
 */
const endedSaid = (name: string, ended: string): string =>
  `the background task “${name}” ended (${ended})`

const toolKey = (id: string): string => `tool:${id}`

/** Two changes as one. Closing the open entry and writing the next one are two
 *  upserts a subscriber should see in the same frame. */
const both = (first: Change, second: Change): Change => ({
  upserts: [...first.upserts, ...second.upserts],
  removes: [...first.removes, ...second.removes],
  appends: [...first.appends, ...second.appends],
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
   * never came back" is recorded, with {@link ToolEntry.stranded} derived from
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
  /** Which row said a background task DIED, by the task's own id — so the
   *  sentence the harness sends a beat after the ending refines that row
   *  instead of minting a second one ({@link #dies}). */
  #ended = new Map<string, string>()
  /**
   * The calls whose NAME has been picked — the one place "this row has been
   * named" is written down, so that a later frame's title cannot move it.
   *
   * A title is a DISPLAY string and the protocol says no more about it than
   * that: an agent is free to send the tool's name while the call is being
   * announced, a sentence about what it is doing while it runs, and something
   * else again when it fails — all about one call, all on frames a reader is
   * watching arrive. Taking the newest as the row's name is a row that renames
   * itself two or three times while somebody is reading it, and — where the
   * call spawned an agent — a lane that renames itself with it, since a lane is
   * named after the row that opened it ({@link ../../web/src/client/chat/lanes.ts}).
   *
   * BESIDE the rows rather than a field on one, for `stranded`'s reason: the
   * name lives in `text`, half a dozen paths re-publish a row by spreading it
   * as it stands, and a flag saying "already named" carried on the row would
   * ride straight past the decision that is supposed to make it. What is kept
   * here is only WHETHER the question has been answered; the answer itself
   * stays where a reader of the row can see it.
   */
  #named = new Set<string>()
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
    this.#ended.clear()
    this.#named.clear()
    this.#open = null
    this.#seq = 0
    return { ...EMPTY, removes }
  }

  /** A row that stands on its own. */
  add<K extends ChatEntry["kind"]>(
    kind: K,
    text: string,
    extra: RowPatch<K> = {},
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
   * not a second way to write a row: two minting paths would be two answers to
   * "how is a row written" for the one kind that has more than one caller.
   *
   * A REPLAY does not come through here, and the difference is what it HAS
   * rather than a second way of writing the same thing: this end has the whole
   * of a message somebody typed before any of it is on the wire, and a replayed
   * one arrives as however many chunks the agent kept it in
   * ({@link userSaid}). One writes a row; the other grows one.
   */
  user(text: string, extra: RowPatch<"user"> = {}): {
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
  #mark(key: string, delivery: Delivery | null): Change {
    const current = this.#entries.get(key)
    // Only a user row carries a delivery. A mark on any other kind was always
    // a type lie the flat struct could not catch; the union makes it a no-op
    // rather than a field written onto a call.
    if (current === undefined || current.kind !== "user") return EMPTY
    // `delivery` comes off along with the derived fields, for the same reason
    // `contentOf` takes those: this line is what DECIDES it, and a spread of
    // the old entry would carry the previous answer past the decision.
    const { delivery: _delivery, ...content } = contentOf(current)
    return this.#put(
      key,
      delivery === null ? content : { ...content, delivery },
    )
  }

  /** One chunk of the agent's prose. Appends to the entry already open, or
   *  opens one. */
  say(text: string): Change {
    return this.#grow("agent", text)
  }

  /**
   * One chunk of what a PERSON said, out of a replay.
   *
   * The same accumulation the agent's own prose gets, and it is one call rather
   * than a row because the protocol's unit is a CHUNK: a message reaches this
   * end as however many pieces the agent kept it in, and a row per piece is one
   * sentence drawn as three bubbles down the side of the panel — somebody's own
   * words, taken apart, in the one place a reader looks to remember what they
   * asked.
   *
   * ONLY a replay reaches this. A message typed here is written whole, by the
   * one caller that keeps its key ({@link user}), because olai has the whole of
   * it before anything is on the wire.
   */
  userSaid(text: string): Change {
    return this.#grow("user", text)
  }

  /**
   * One chunk into the entry already open, or into a new one.
   *
   * ONE function for the two kinds that arrive in pieces, and the KIND is what
   * decides whether the open entry is the right one to grow: a tool frame
   * closes whatever was open, but nothing closes a paragraph between a person's
   * words and the agent's answer to them, so an agent chunk appended to an open
   * user row would put the answer inside the question.
   */
  #grow(kind: "agent" | "user", text: string): Change {
    const open = this.#open
    const current = open === null ? undefined : this.#entries.get(open)
    if (open !== null && current?.kind === kind) {
      // THE PIECE GOES OUT; THE WHOLE IS KEPT. The row here grows by the chunk
      // — it is the transcript's own copy and every later publish of this row
      // reads it — and what is REPORTED is the chunk and where it belongs
      // ({@link Change.appends}). Reporting the row instead is the same text
      // published once per token, which is quadratic in the length of the
      // answer and is what this line stopped doing.
      const at = current.text.length
      this.#write(open, { ...contentOf(current), text: `${current.text}${text}` })
      return { ...EMPTY, appends: [{ of: open, at, text }] }
    }
    // A row that is not there yet is WRITTEN, whole and with its first chunk in
    // it: there is nothing on the far end to append to. It costs one chunk.
    const closed = this.#close()
    this.#open = this.#next(kind)
    return both(closed, this.#put(this.#open, { kind, text }))
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
    return this.#strand(false)
  }

  /** The turn ended: whatever was streaming has stopped, and so has anything
   *  the agent announced and never reported back on — except a call that armed
   *  a background task, which is the one kind of call a turn ending says
   *  nothing about ({@link #strand}). */
  settle(): Change {
    return both(this.#close(), this.#strand(false))
  }

  /**
   * The CONVERSATION is over — the agent died — and that is a different
   * sentence from a turn ending.
   *
   * A turn ending leaves an armed task alone: the task outlives the turn on
   * purpose, and the harness reports its end whenever that comes, in whatever
   * turn happens to be open or in none at all. A dead agent reports nothing
   * ever again, so the tasks it left out there are exactly as abandoned as the
   * calls it never came back for — and a rail still pulsing under a process
   * that no longer exists is the failure every live face in this panel is
   * written against.
   *
   * Its own door rather than a flag on {@link settle}, because the two are
   * asked by different callers about different facts: every turn ends, and a
   * conversation ends once.
   */
  abandon(): Change {
    return both(this.#close(), this.#strand(true))
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
  #strand(alsoArmed: boolean): Change {
    let change: Change = EMPTY
    for (const [key, entry] of this.#entries) {
      if (entry.kind !== "tool" || this.#stranded.has(key)) continue
      if (!isRunningStatus(entry.status)) continue
      // A CALL THAT ARMED A BACKGROUND TASK IS NOT ONE ITS TURN WALKED AWAY
      // FROM. It is the one kind of call whose whole point is to outlive the
      // turn — a monitor watches a PR for an hour, a background build runs while
      // the conversation moves on — and the harness reports its end whenever
      // that comes, in whatever turn happens to be open (or in none). Marking it
      // here would put out the live face at the moment the task starts doing its
      // work, and the row would say "abandoned" about the very thing the panel
      // was asked to show.
      //
      // ... UNTIL IT HAS ENDED, and until the CONVERSATION ends, which is
      // {@link abandon}'s door: a dead agent's tasks are as abandoned as its
      // calls, because a dead agent reports the death of nothing. Both halves
      // are `isTaskOut`'s, in the surface beside the status vocabulary, because
      // the browser asks the same question about the same row and the two must
      // not answer differently.
      if (!alsoArmed && isTaskOut(entry)) continue
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
   * THE TITLE IS THE ONE EXCEPTION, and it is an exception to "the newest wins"
   * rather than to "absent means unchanged": a title is a display string an
   * agent may rewrite for its own reasons, so the row's NAME is picked at the
   * first frame that carries one and no later frame moves it ({@link #named}).
   *
   * A FRAME THAT SAYS NOTHING NEW CHANGES NOTHING. Agents repeat themselves —
   * some send a report twice, byte for byte — and a repeat is not a second
   * report: nothing about the call moved, so nothing is published and, in
   * particular, the mark saying its turn walked away from it does not come off.
   * It is {@link #strand}'s own rule ("a row already marked is skipped rather
   * than re-published") applied at the door frames actually arrive through.
   *
   * A tool frame also CLOSES the open prose entry: the agent said something,
   * then did something, and the next thing it says is a new paragraph. That
   * happens for a repeat too — the paragraph ended when the call was first
   * reported, and a second report of it does not un-end it.
   */
  tool(
    id: string,
    move: {
      readonly title?: string | undefined
      readonly status?: ToolStatus | undefined
      readonly detail?: string | undefined
      readonly progress?: string | undefined
      readonly diffs?: ReadonlyArray<FileDiff> | undefined
      readonly wrote?: Wrote | undefined
      readonly locations?: ReadonlyArray<string> | undefined
      readonly parent?: string | undefined
      readonly spawned?: Spawned | undefined
      readonly armed?: Armed | undefined
    },
  ): Change {
    const key = toolKey(id)
    const current = this.#entries.get(key)
    const held = current?.kind === "tool" ? current : undefined
    const detail = move.detail ?? held?.detail
    // The protocol's own rule, and the reason neither of these accumulates: a
    // report carries the call's content and locations AS THEY STAND, so
    // appending would print the first half of a long output twice.
    const progress = move.progress ?? held?.progress
    // The same rule for what the call CHANGED, and it is what keeps a diff on
    // screen: the announcement carries the blocks, the completion that follows
    // carries only a status, and a row that read that as "no diffs now" would
    // drop the change at the moment the call finished.
    const diffs = move.diffs ?? held?.diffs
    const wrote = move.wrote ?? held?.wrote
    const locations = move.locations ?? held?.locations
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
    const parent = move.parent === undefined ? held?.parent : toolKey(move.parent)
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
      ? held?.spawned
      : { ...held?.spawned, ...move.spawned }
    // ... and what this call ARMED, under the same rule one word deeper and for
    // the same reason: the fact arrives split across frames because the TASK's
    // OWN LIFE is. The frame that arms the call names the task, its kind and the
    // description it was armed with; the frame that settles it names the task
    // and how it ended, minutes later and in another turn. Neither repeats the
    // other's fields, so a spread is what keeps the description on the row at
    // the moment it dies — which is the row a person reads.
    const armed = move.armed === undefined
      ? held?.armed
      : { ...held?.armed, ...move.armed }
    // THE NAME, PICKED ONCE — at the first frame that carries a title, which
    // for a live call is its announcement and for a replayed one is the
    // collapsed frame that is all there ever was of it. Whether the question
    // has been answered is remembered beside the rows ({@link #named}) rather
    // than inferred from the row wearing its own id, which is a name an agent
    // is free to have chosen.
    //
    // BESIDE ITS SIX SIBLINGS rather than inside the row below, because it is
    // the one field of this merge that does NOT follow "the newest wins" and a
    // reader looking for the rules is looking here.
    //
    // The remembering happens BEFORE the repeat guard below, and it has to: a
    // frame whose title is the name the row is already wearing says nothing
    // new and is answered by that guard, and a row left unnamed by it would be
    // renamed by the next frame that carried a different one.
    const named = this.#named.has(key)
    if (move.title !== undefined) this.#named.add(key)
    const text = (named ? undefined : move.title) ?? held?.text ?? id
    // THE TOOL ARM, named — so the comparison below is between two values of
    // one kind rather than two of a six-armed union, and a field that belongs
    // to somebody else's row is a type error here rather than a key silently
    // dropped at the far end.
    const content: Extract<RowContent, { kind: "tool" }> = {
      kind: "tool",
      text,
      status: move.status ?? held?.status ?? "pending",
      ...(detail === undefined ? {} : { detail }),
      ...(progress === undefined ? {} : { progress }),
      ...(diffs === undefined ? {} : { diffs }),
      ...(wrote === undefined ? {} : { wrote }),
      ...(locations === undefined ? {} : { locations }),
      ...(parent === undefined ? {} : { parent }),
      ...(spawned === undefined ? {} : { spawned }),
      ...(armed === undefined ? {} : { armed }),
    }
    // THE DEATH OF A TASK IS ALSO A ROW AT THE BOTTOM ({@link #dies}), and
    // this is where the transition is seen: the frame that carries an ending
    // for a row that did not have one. Computed before the repeat guard below
    // and published after the row itself, so a reader meets the call's own
    // ending and then the line saying so, in that order.
    // ONE CALL for both of the shapes that reach it — the ending, and the
    // sentence that lands a beat after it — because which of the two this is
    // is a fact about what has been written, and {@link #dies} is what holds
    // that. A caller deciding it out here would be the same question answered
    // in two places, one of them by the order two frames happened to arrive in.
    const died = armed?.ended === undefined
      ? EMPTY
      : this.#dies(armed.task, armed.description ?? text, armed.ended, move.progress)
    const closed = this.#close()
    // A REPEAT IS NOT A REPORT. Nothing moved, so nothing is written — and the
    // strand mark below stays on, which is the half that matters: a row whose
    // turn walked away from it would otherwise start looking like work in
    // progress again on the strength of a frame that said what the row already
    // said.
    //
    // The comparison is the runtime's own, over the WHOLE content rather than
    // field by field: a comparator that named the fields would be a second list
    // of them, and the day a row grows a tenth the list deciding what a report
    // SAYS and the list deciding whether two reports say the same would drift
    // apart in silence. It is also cheap where it matters — a field this merge
    // took from the row it is updating IS the row's own value, so a frame that
    // carried nothing new is answered by reference at each of them.
    // A REPEAT still carries a death: the frame that brings the harness's
    // sentence says nothing new about the CALL (its ending is already on the
    // row) and everything about the line at the bottom.
    if (held !== undefined && isDeepStrictEqual(contentOf(held), content)) {
      return both(closed, died)
    }
    // ANYTHING HERE KNOWING. The mark means "as far as this end can tell, that
    // one never came back", and a report about it is this end being told
    // otherwise — so it comes off, and `#put` below re-derives the field from
    // the set rather than from whatever the row was carrying.
    this.#stranded.delete(key)
    return both(both(closed, this.#put(key, content)), died)
  }


  /**
   * A BACKGROUND TASK ENDED — and the ending lands at the BOTTOM, as a row of
   * its own, at the moment it happens.
   *
   * The ruling this exists for (the human, 2026-08-24, after probing the
   * design): a task's own row is at its birth position, and a monitor armed at
   * the top of a three-hour session is three hours of scrollback away by the
   * time it dies. Editing the death into that row alone puts the one fact a
   * person supervising off a monitor must not miss somewhere they are not
   * looking — so it is ALSO said where they are, which in a transcript is the
   * end of it.
   *
   * Not INSTEAD: the arming row keeps its own ending, because it is the record
   * of what happened to that call and a reader who does scroll back is owed the
   * whole of it. Two places, one event, and neither of them is a copy of the
   * other's job.
   *
   * THE HARNESS'S OWN SENTENCE where there is one, which is where a background
   * shell's exit code lives (*Background command "…" failed with exit code 3*).
   * It arrives on the frame AFTER the one that ends the task — the two bookends
   * are a guaranteed patch and a summary beside it — so the row is minted on
   * the ending and REFINED when the sentence lands, keyed by the task
   * ({@link #ended}) rather than re-minted. A second row would be the same
   * death reported twice.
   */
  #dies(task: string, name: string, ended: string, said: string | undefined): Change {
    const already = this.#ended.get(task)
    if (already === undefined) {
      const { key, change } = this.#row("notice", said ?? endedSaid(name, ended), {})
      this.#ended.set(task, key)
      return change
    }
    // The summary, arriving after the ending it belongs to. Nothing to say
    // until it does, and nothing to say twice once it has.
    const held = this.#entries.get(already)
    if (said === undefined || held === undefined || held.text === said) return EMPTY
    return this.#put(already, { kind: "notice", text: said })
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
    if (current === undefined || current.kind !== "ask") return EMPTY
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

  /** Mint a row that is FINISHED the moment it is written, and answer with
   *  BOTH its key and the change — the one shape every writer here needs some
   *  part of: {@link add} takes the change and drops the key, {@link user}
   *  keeps both.
   *
   *  A row that GROWS cannot come through here, which is the whole of the
   *  difference between this and {@link #grow}: an open row has to be the open
   *  one before it is published, or the first chunk of it goes out without the
   *  flag that says more is coming. Two minting paths, then — and they are two
   *  because a row that is complete and a row that is still arriving are two
   *  things, not because anybody wrote the second one twice. */
  #row<K extends ChatEntry["kind"]>(kind: K, text: string, extra: RowPatch<K>): {
    readonly key: string
    readonly change: Change
  } {
    const key = this.#next(kind)
    return {
      key,
      change: both(
        this.#close(),
        this.#put(key, { kind, text, ...extra } as Extract<RowContent, { kind: K }>),
      ),
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
    return { ...EMPTY, upserts: [[key, this.#write(key, entry)]] }
  }

  /** The write itself, answering with the row as it now stands — and the one
   *  place a row is stored, which is what makes the derivations above a
   *  property rather than a habit.
   *
   *  It is split from {@link #put} for exactly one caller: {@link #grow}'s
   *  append path, which has to WRITE the row (the transcript keeps every row
   *  whole) and must not PUBLISH it (what goes out is the piece). Splitting the
   *  publish off the write is what lets those two be different answers without
   *  a second way of deriving a row's fields. */
  #write(key: string, entry: RowContent): ChatEntry {
    const existing = this.#entries.get(key)
    const derived = {
      id: key,
      seq: existing?.seq ?? this.#seq++,
      since: existing?.since ?? new Date(this.#now()).toISOString(),
    }
    const next = minted(
      entry,
      derived,
      entry.kind === "agent" && key === this.#open,
      entry.kind === "tool" && this.#stranded.has(key),
    )
    this.#entries.set(key, next)
    return next
  }
}
