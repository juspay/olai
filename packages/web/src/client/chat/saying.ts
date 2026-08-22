/**
 * The row still being said, as this tab holds it — the pieces folded, and the
 * join back onto the row they belong to.
 *
 * A growing row does not arrive as a row. The server publishes the transcript
 * row WHOLE whenever it has something whole to say about it, and everything
 * that happens in between — an agent streaming a token at a time — arrives on
 * a second member as PIECES, each carrying only its new text and where in the
 * row it starts (`@olai/surface`'s `Saying`, which argues why). What the panel
 * draws is the two put back together, and this module is both halves of that:
 * the fold that accumulates the pieces off the frames, and the function that
 * lays them onto a row.
 *
 * THE JOIN IS TOTAL AND IDEMPOTENT, which is the whole reason a tab may hold
 * the two facts separately at all. The row's own text is complete as far as it
 * goes — the server never publishes a row's text in part — so a piece is
 * either text the row already has (it ends at or before the row's length: it
 * adds nothing) or text past it (it contributes exactly the part past). Both
 * answers are correct at every instant, in either arrival order, which is what
 * a pair of subscriptions can actually promise: they are snapshotted a moment
 * apart, and the frames that follow interleave.
 *
 * ONE ROW AT A TIME, because that is what a conversation is: the transcript has
 * one open entry, so at most one row has pieces on the wire, and the fold holds
 * one tail rather than a map of them. What that buys is at the READER's end —
 * a row asks "am I the one growing" of a memo that moves once a paragraph
 * rather than reading the tail itself and waking every row on screen a dozen
 * times a second ({@link ./state.ts}).
 */

import type { Saying } from "@olai/surface"
import type { CollectionFoldOptions } from "@kolu/surface/solid"

/** The pieces of one row, joined: which row, where the joined run starts, and
 *  what it says. `at` travels with the text because the join needs it — it is
 *  what says whether this run is ahead of the row or already inside it. */
export interface Tail {
  readonly of: string
  readonly at: number
  readonly text: string
}

/**
 * The accumulator: every piece this tab holds, and the tail they join to.
 *
 * TWO FIELDS for the reason `./order.ts`'s has two. `pieces` is this fold's
 * working memory and is MUTATED in place — it is reachable from nowhere else,
 * and copying it per frame would be the walk the fold exists to avoid. `tail`
 * is what LEAVES, so it is rebuilt rather than written into, and a frame that
 * moved nothing hands back the accumulator it was already holding — which is
 * what lets the memos over it settle instead of waking a panel per frame.
 */
export interface Growing {
  readonly pieces: Map<string, Saying>
  readonly tail: Tail | null
}

/**
 * The tail the held pieces make, or `null` when there is none.
 *
 * WHOSE they are is the row of the piece most recently written, which is the
 * insertion order a `Map` keeps: pieces of a row are removed in the same frame
 * that publishes the row whole, so two rows' pieces do not coexist — and if
 * they ever did, the row still being said is the one that was said into last.
 *
 * IT STOPS AT A HOLE rather than gluing across one. Pieces of a row are
 * contiguous by construction (each starts where the last ended), so a gap
 * means a piece this tab has not been handed — and a string that jumped the
 * gap would be text in the wrong order presented as the answer. The run up to
 * the hole is honest, and the row's next whole publication carries the rest.
 */
const joined = (pieces: Map<string, Saying>): Tail | null => {
  let of: string | undefined
  for (const piece of pieces.values()) of = piece.of
  if (of === undefined) return null
  const run = [...pieces.values()]
    .filter((piece) => piece.of === of)
    .sort((one, other) => one.at - other.at)
  const first = run[0]
  if (first === undefined) return null
  let text = ""
  for (const piece of run) {
    if (piece.at !== first.at + text.length) break
    text += piece.text
  }
  return { of, at: first.at, text }
}

const growing = (pieces: Map<string, Saying>): Growing => ({
  pieces,
  tail: joined(pieces),
})

/**
 * The fold: seed from a full-set frame, and step one delta.
 *
 * A MODULE CONSTANT for {@link ./order.ts}'s reason — it holds nothing, so two
 * panels open at once each get their own accumulator from the one pair of
 * callbacks.
 *
 * TOTAL OVER A REMOVE IT HAS NEVER SEEN, which the socket requires: the
 * server's tick coalescer resolves an upsert-then-remove inside one producer
 * tick to a bare remove, so a piece published and superseded within one tick
 * arrives as a remove that was never preceded by an upsert.
 */
export const TRANSCRIPT_TAIL: CollectionFoldOptions<string, Saying, Growing> = {
  init: (entries) => growing(new Map(entries.map(([key, piece]) => [key, piece]))),
  step: (held, { upserts, removes }) => {
    let moved = false
    for (const key of removes) if (held.pieces.delete(key)) moved = true
    for (const [key, piece] of upserts) {
      held.pieces.set(key, piece)
      moved = true
    }
    return moved ? growing(held.pieces) : held
  },
}

/**
 * A row's text with the tail laid onto it — the join, and the one place the
 * idempotence this whole arrangement rests on is spelled.
 *
 * Three answers, and each is the row's own text in a different amount:
 *
 *   - the run ends at or before the row's length: the row already carries every
 *     character of it, so the row's text IS the answer. This is what a tab
 *     handed a fresh snapshot sees, and what every reader sees the moment a
 *     paragraph ends;
 *   - the run starts past the row's length: a piece this tab has not been
 *     handed sits between them. The row's text is what can honestly be shown,
 *     and the row's next whole publication closes the gap;
 *   - otherwise the run overlaps the end of the row and continues past it, so
 *     what it adds is exactly the part past it.
 */
export const grownText = (
  row: { readonly text: string },
  tail: Tail,
): string => {
  const held = row.text.length
  if (tail.at + tail.text.length <= held) return row.text
  if (tail.at > held) return row.text
  return `${row.text}${tail.text.slice(held - tail.at)}`
}
