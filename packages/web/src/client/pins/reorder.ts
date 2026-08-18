/**
 * WHERE A DRAGGED PIN WOULD LAND, and the one write that puts it there.
 *
 * The whole of reordering the shelf that is arithmetic, kept apart from the
 * gesture for the reason `../drag/plan.ts` is kept apart from `../drag/dragging.ts`:
 * "which gap is the pointer over" and "what does moving row 3 to gap 1 mean"
 * are answerable with numbers, and a component is where they stop being
 * testable.
 *
 * IT IS NOT `../drag/plan.ts` REUSED, and that is a judgment rather than an
 * oversight. That planner is about an OUTLINE: depth, a parent per row, the
 * rule that a branch is never offered a place inside itself, a refusal when the
 * pointer is over a pane holding another file. A shelf has none of those — it
 * is a flat list of doors in one container — so what would be shared is the
 * word "drag" and nothing underneath it. What IS shared is the part that was
 * worth sharing: the gesture itself, from `../pointer.ts`, which owns the
 * window listeners, the teardown, the text-selection guard and the travel that
 * tells a drag from a click on a row that is also a link.
 *
 * AND THE WRITE IS `place`, which already existed for exactly this shape: a
 * parent and the sibling to sit after. The tree's drag sends it, an undo sends
 * it, and it resolves to the `move_node` an agent would send — so reordering
 * the shelf needed no wire verb and no op, which is the same sentence
 * drag-and-drop got to write.
 */

import type { Edit } from "@olai/surface"

import type { Pin } from "./pins.ts"

/**
 * Which GAP a pointer at `y` is over, given each row's vertical midpoint in
 * the same coordinate space — `0` above the first row, `pins.length` below the
 * last.
 *
 * MIDPOINTS rather than boxes, because a gap is decided by which half of a row
 * the pointer is in and nothing else here needs a width. Measured once when the
 * drag begins and passed in, exactly as the tree's drag measures its lines
 * once: a forced layout per frame would be a re-measure for an answer that
 * cannot have changed while nothing on screen is moving.
 */
export const gapAt = (middles: ReadonlyArray<number>, y: number): number => {
  let gap = 0
  for (const middle of middles) {
    if (y < middle) break
    gap += 1
  }
  return gap
}

/**
 * Moving the pin at `from` into `gap` — or `undefined` when that is where it
 * already is, which is what a drag that travelled and came back means and is a
 * write nobody should be sent.
 *
 * `gap` is counted over the shelf AS DRAWN, with the carried row still in it,
 * because that is what the pointer was over. The row is taken out before the
 * neighbour is read, which is the only subtlety here: dropping row 3 into gap 3
 * or gap 4 is the same shelf, and reading the neighbour off the undisturbed
 * list would answer "after itself".
 */
export const placing = (
  pins: ReadonlyArray<Pin>,
  from: number,
  gap: number,
): Edit | undefined => {
  const carried = pins[from]
  if (carried === undefined) return undefined
  const rest = pins.filter((_, at) => at !== from)
  // The gap, read against the list the row has left: everything above `from`
  // keeps its index, everything below it shifts up one.
  const landing = gap > from ? gap - 1 : gap
  if (landing === from) return undefined
  const above = landing === 0 ? null : rest[landing - 1]?.id ?? null
  return {
    verb: "place",
    id: carried.id,
    // The shelf is one outline's TOP LEVEL, so there is no parent to name and
    // `null` is the answer rather than an absence — which is exactly the shape
    // `place` takes (`@olai/surface`'s `edit.ts`).
    parent: null,
    after: above,
  }
}
