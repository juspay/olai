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

export class Transcript {
  #entries = new Map<string, ChatEntry>()
  #seq = 0
  /** The agent entry currently being streamed into, if any. Chunks accumulate
   *  rather than each becoming a row: what a reader wants is one paragraph
   *  growing, not forty. */
  #open: string | null = null
  #minted = 0

  entries(): ReadonlyMap<string, ChatEntry> {
    return this.#entries
  }

  get(key: string): ChatEntry | undefined {
    return this.#entries.get(key)
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
    this.#open = null
    return this.#put(this.#mint(kind), { kind, text, ...extra })
  }

  /** One chunk of the agent's prose. Appends to the entry already open, or
   *  opens one. */
  say(text: string): Change {
    if (this.#open === null) {
      const key = this.#mint("agent")
      this.#open = key
      return this.#put(key, { kind: "agent", text, streaming: true })
    }
    const current = this.#entries.get(this.#open)
    const key = this.#open
    return this.#put(key, {
      kind: "agent",
      text: `${current?.text ?? ""}${text}`,
      streaming: true,
    })
  }

  /** The turn ended: whatever was streaming has stopped. */
  settle(): Change {
    const key = this.#open
    this.#open = null
    if (key === null) return EMPTY
    const current = this.#entries.get(key)
    if (current === undefined || current.streaming !== true) return EMPTY
    const { streaming: _dropped, ...rest } = current
    this.#entries.set(key, rest)
    return { upserts: [[key, rest]], removes: [] }
  }

  /**
   * A tool call, announced or moved. Keyed by the agent's own call id, so the
   * second report of a call is the same row with a new status rather than a
   * second row — which is the whole reason the transcript is keyed.
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
    this.#open = null
    const key = `tool:${id}`
    const current = this.#entries.get(key)
    const next: Omit<ChatEntry, "id" | "seq"> = {
      kind: "tool",
      text: move.title ?? current?.text ?? id,
      status: move.status ?? current?.status ?? "pending",
      ...(move.detail ?? current?.detail) === undefined
        ? {}
        : { detail: move.detail ?? current?.detail },
    }
    return this.#put(current === undefined ? this.#mint("tool", key) : key, next)
  }

  /** A write the ops layer refused. Its own kind, because the panel draws the
   *  structured detail rather than the sentence. */
  refuse(text: string, failure: OpFailure): Change {
    return this.add("refusal", text, { refusal: failure })
  }

  #mint(kind: string, key?: string): string {
    return key ?? `${kind}:${++this.#minted}`
  }

  #put(key: string, entry: Omit<ChatEntry, "id" | "seq">): Change {
    const existing = this.#entries.get(key)
    const next: ChatEntry = {
      ...entry,
      id: key,
      seq: existing?.seq ?? this.#seq++,
    }
    this.#entries.set(key, next)
    return { upserts: [[key, next]], removes: [] }
  }
}

const EMPTY: Change = { upserts: [], removes: [] }
