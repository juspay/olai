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

import type { ChatEntry, OpFailure } from "@olai/surface"

export interface Change {
  readonly upserts: ReadonlyArray<readonly [string, ChatEntry]>
  readonly removes: ReadonlyArray<string>
}

const EMPTY: Change = { upserts: [], removes: [] }

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

  entries(): ReadonlyMap<string, ChatEntry> {
    return this.#entries
  }

  /** Everything, gone — a new session, or one being loaded. The removes are
   *  reported so a subscriber's own copy empties rather than accumulating two
   *  conversations. */
  clear(): Change {
    const removes = [...this.#entries.keys()]
    this.#entries.clear()
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
    return both(this.#close(), this.#put(this.#next(kind), { kind, text, ...extra }))
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
    },
  ): Change {
    const key = `tool:${id}`
    const current = this.#entries.get(key)
    const detail = move.detail ?? current?.detail
    return both(
      this.#close(),
      this.#put(key, {
        kind: "tool",
        text: move.title ?? current?.text ?? id,
        status: move.status ?? current?.status ?? "pending",
        ...(detail === undefined ? {} : { detail }),
      }),
    )
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
    // The three fields `#put` mints are dropped rather than passed back in:
    // `streaming` especially, because a spread of the old entry would carry the
    // flag straight past the derivation that is supposed to decide it.
    const { id: _id, seq: _seq, streaming: _streaming, ...content } = current
    return this.#put(key, content)
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
