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
 * Everything here is synchronous and in memory. The transcript is not
 * persisted: the agent's own session is the persistence (that is the whole
 * point of adopting one on boot), and a second copy would be a second thing to
 * be wrong.
 */

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
): Omit<ChatEntry, "id" | "seq" | "streaming"> => {
  const { id: _id, seq: _seq, streaming: _streaming, ...content } = entry
  return content
}

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
   * What it would take to send an `unsent` row again, by that row's key.
   *
   * HERE, beside the rows, rather than in the caller that knows about agents —
   * because it is half of one fact and the other half is a field on the entry.
   * A row marked `unsent` with no prompt behind it draws a button that refuses;
   * a prompt with no row is a message nobody can see. Kept together, neither is
   * constructible: {@link unsent} writes both, {@link sent} drops both, and
   * {@link clear} — the one place a conversation ends — takes both with it
   * instead of a caller having to remember the second.
   *
   * The prompt is OPAQUE to this file: it is the agent's own string, with tmp
   * paths in it, and nothing here reads it or publishes it. The transcript
   * stores it and hands it back.
   */
  #undelivered = new Map<string, string>()

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
    this.#open = null
    this.#seq = 0
    return { upserts: [], removes }
  }

  /** A row that stands on its own. */
  add(
    kind: ChatEntry["kind"],
    text: string,
    extra: Partial<ChatEntry> = {},
  ): Change {
    return this.#row(kind, text, extra).change
  }

  /**
   * What a person said — a row like any other, ANSWERING WITH ITS KEY.
   *
   * The one caller that has to keep a key. Every other entry is written and
   * forgotten, but a user message can turn out to be undeliverable after it
   * has been drawn ({@link unsent}), and a retry that lands has to find the
   * same row again — so the key comes back here rather than being fished out
   * of the change or re-derived from a counter kept somewhere else.
   *
   * It is the same door as {@link add} with the key kept ({@link #row}), and
   * not a second way to write a row: `add("user", …)` is still what a REPLAY
   * uses, and two minting paths would be two answers to "how is a row
   * written" for the one kind that has both.
   */
  user(text: string, extra: Partial<ChatEntry> = {}): {
    readonly key: string
    readonly change: Change
  } {
    return this.#row("user", text, extra)
  }

  /**
   * That message never reached the agent, and here is what it would take to
   * send it again.
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
  unsent(key: string, prompt: string): Change {
    if (!this.#entries.has(key)) return EMPTY
    this.#undelivered.set(key, prompt)
    return this.#mark(key, true)
  }

  /** ... and it has now. The mark comes off and the prompt is let go: a row
   *  must not go on advertising a failure that has stopped being true, and a
   *  prompt kept past its row's mark is a retry nothing can ask for. */
  sent(key: string): Change {
    this.#undelivered.delete(key)
    return this.#mark(key, false)
  }

  /** What it would take to send that row again, or `null` when it is not one
   *  that failed. The prompt the agent refused, verbatim — never rebuilt from
   *  the row, which carries its pictures by name where the prompt carries
   *  their paths. */
  undelivered(key: string): string | null {
    return this.#undelivered.get(key) ?? null
  }

  /** The `unsent` field, on or off, without minting a row for a key that has
   *  gone. Private because the field never moves without the prompt beside it
   *  — which is the whole reason both live here. */
  #mark(key: string, undelivered: boolean): Change {
    const current = this.#entries.get(key)
    if (current === undefined) return EMPTY
    // `unsent` comes off along with the derived fields, for the same reason
    // `contentOf` takes those: this line is what DECIDES it, and a spread of
    // the old entry would carry the previous answer past the decision.
    const { unsent: _unsent, ...content } = contentOf(current)
    return this.#put(key, undelivered ? { ...content, unsent: true } : content)
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

  /** The turn ended: whatever was streaming has stopped. */
  settle(): Change {
    return this.#close()
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
    // frames — the spawn says it is one and carries the arguments the agent
    // was sent with, the beats that follow name the agent's kind and say
    // nothing about being a spawn, the completion says neither — so a report
    // that answered about the spawn without naming a kind would take back a
    // kind an earlier frame already gave.
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
   */
  ask(id: string, message: string, fields: ReadonlyArray<AskField>): Change {
    return both(
      this.#close(),
      this.#put(id, { kind: "ask", text: message, ask: { fields, outcome: null } }),
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
    return this.#put(id, {
      kind: "ask",
      text: current.text,
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
  #row(kind: ChatEntry["kind"], text: string, extra: Partial<ChatEntry>): {
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
   *  set it, and none can forget to. */
  #put(
    key: string,
    entry: Omit<ChatEntry, "id" | "seq" | "streaming">,
  ): Change {
    const existing = this.#entries.get(key)
    const next: ChatEntry = {
      ...entry,
      id: key,
      seq: existing?.seq ?? this.#seq++,
      ...(key === this.#open ? { streaming: true as const } : {}),
    }
    this.#entries.set(key, next)
    return { upserts: [[key, next]], removes: [] }
  }
}
