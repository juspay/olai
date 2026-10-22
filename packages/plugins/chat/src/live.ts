/**
 * WHICH CONVERSATIONS WERE LIVE A MOMENT AGO — the record a restart reads to
 * reopen them, and the reason a browser no longer has to be the one that says
 * so.
 *
 * ## What is in it, and what is deliberately not
 *
 * A NODE ID and the instant it was last touched. Nothing else:
 *
 *   - **no session id**, because the vault already keeps one on the node
 *     (`prop:agent-session`), and the current property is the only copy that
 *     can be believed. A session stored HERE would be resurrected after a fresh
 *     start or a rebind, which is exactly the conversation the node has left;
 *   - **no engine**, for the same reason — the property names it, and a node
 *     moved to another engine must reopen on the engine it now runs;
 *   - **no decision about which conversations count.** A history read, a
 *     refused open and a gone agent are not conversations a restart should
 *     wake, and the scheduler that owns those slots answers that once
 *     ({@link ./scoped.ts}'s `recordable`). This module stores what it is
 *     handed.
 *
 * ## Where it lives, and the one justification it needs
 *
 * In chat's own machine-local document ({@link ./local.ts}), under the same
 * permit as the model, wake and heard records. It is a fact about THIS machine
 * and THIS directory, so it belongs in the same file on the same terms; a
 * second store would be a second thing to prune, migrate and merge.
 *
 * ## Most recently touched first, capped
 *
 * The order is the one a restart needs: when more entries are recorded than the
 * scheduler can hold, the ones that were live LONGEST AGO are the ones to lose.
 * {@link RECORDED} is the scheduler's default capacity too, because the live
 * half of the record can never be larger than that — the cap only ever bites
 * the union with entries still waiting for their engine.
 *
 * An unreadable row is dropped rather than guessed at: a record that could not
 * say when a node was touched cannot decide whether its budget is spent, and
 * reopening it would be inventing a budget it never had.
 */

import type { ChatLocalState } from "./local.ts"
import { MemoryFailure, word } from "./memory.ts"
import { Effect } from "effect"

/** This state machine's section in chat's one machine-local document. */
const LIVE = "live"

/** The most conversations one serve holds — the scheduler's default capacity
 *  is this same number ({@link ./scoped.ts}'s `DEFAULT_CAPACITY` is this
 *  constant), so there is one bound rather than two that can drift. */
export const RECORDED = 8

/**
 * One node that was live, and when its conversation was last touched.
 *
 * EPOCH MILLISECONDS, not the ISO text the file carries: an instant is what
 * the scheduler compares budgets with, and how a note spells one is this
 * module's business. {@link forLocalState} is the only place the two meet.
 */
export interface LiveMark {
  readonly node: string
  readonly touched: number
}

/** Read the record, write the whole set, or answer nothing. */
export interface LiveRecord {
  /** Most recently touched first, as last written. Empty when this machine has
   *  never had a live conversation in this directory. */
  readonly read: () => ReadonlyArray<LiveMark>
  /** Replace the whole set. The caller hands every mark it wants kept; this
   *  module orders, dedupes and caps, so the invariant is not the caller's to
   *  remember. */
  readonly write: (rows: ReadonlyArray<LiveMark>) => Effect.Effect<void, MemoryFailure>
}

/** A legible mark, or nothing. A row without a node, without an instant, or
 *  with an instant the clock cannot read names nothing this can reopen. */
const read = (held: Record<string, unknown>): ReadonlyArray<LiveMark> => {
  const rows = held["live"]
  if (!Array.isArray(rows)) return []
  return rows.flatMap((one) => {
    if (one === null || typeof one !== "object") return []
    const row = one as Record<string, unknown>
    const node = word(row["node"])
    const touched = word(row["touched"])
    const at = touched === null ? Number.NaN : Date.parse(touched)
    if (node === null || Number.isNaN(at)) return []
    return [{ node, touched: at }]
  })
}

/**
 * The record's rows, newest first and capped — PURE, so the ordering and the
 * cap are decided in a unit test rather than by killing a server.
 *
 * `live` is what the scheduler holds NOW; `waiting` is what is still waiting
 * for its engine. A node can be in both for one instant — the entry is deleted
 * only after its slot answers — and the live mark wins, because it is the
 * fresher of the two and the one whose slot is actually open.
 */
export const marksOf = (
  live: ReadonlyArray<{ readonly node: string; readonly touched: number }>,
  waiting: ReadonlyArray<{ readonly node: string; readonly touched: number }> = [],
): ReadonlyArray<LiveMark> => {
  const held = new Map<string, number>()
  for (const row of waiting) held.set(row.node, row.touched)
  for (const row of live) held.set(row.node, row.touched)
  return [...held]
    .filter(([, touched]) => !Number.isNaN(touched))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, RECORDED)
    .map(([node, touched]) => ({ node, touched }))
}

/** The record over one activation's local document. */
export const forLocalState = (local: ChatLocalState): LiveRecord => {
  const held = local.load(LIVE)
  let rows = held === null ? [] : read(held)
  return {
    read: () => rows,
    write: (next) =>
      Effect.gen(function*() {
        const table = marksOf(next)
        yield* local.save(LIVE, {
          live: table.map((row) => ({ node: row.node, touched: new Date(row.touched).toISOString() })),
        })
        rows = table
      }),
  }
}
