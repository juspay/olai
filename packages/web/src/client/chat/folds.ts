/**
 * Which tool calls the reader has unfolded, by the call's own id.
 *
 * MODULE-SCOPED, and keyed by id rather than held inside the row, because the
 * row is not the thing that lasts. The panel is rebuilt from nothing whenever
 * the drawer is closed and opened, so a fold kept in the component's own
 * `createSignal` comes back shut — and the line somebody unfolded is, by
 * definition, the one they wanted to keep looking at.
 *
 * Keying by the call id is also what makes the racket panel's rule hold: the
 * SAME id is the same line, so a line redrawn into a later turn comes up open.
 * The frame vocabulary already says an id identifies a call across updates
 * ({@link ../../../../server/src/chat/transcript.ts}); this is the reader's
 * side of that same fact.
 *
 * Nothing is stored and nothing is sent: an unfolded row belongs to a reading,
 * like a collapsed outline node does.
 */

import { createSignal } from "solid-js"

const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>(new Set())

/** Is this call's detail showing? */
export const isUnfolded = (id: string): boolean => unfolded().has(id)

export const toggleFold = (id: string): void => {
  setUnfolded((open) => {
    const next = new Set(open)
    if (!next.delete(id)) next.add(id)
    return next
  })
}
