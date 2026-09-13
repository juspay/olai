import { flatten } from "../edit/order.ts"
import { depthOf } from "../select/range.ts"
import { airborne } from "./air.ts"
import type { Field } from "./fields.ts"
import { measureLines } from "./lines.ts"
import type { Placed } from "./plan.ts"

/**
 * One page's rows, as places a drop may land beside. Shared by row moving
 * and text receiving; the caller owns when to measure and how long to keep it.
 *
 * THE CHEAP QUESTIONS FIRST, and the order is not arbitrary: measuring is the
 * only thing here that costs anything (a `querySelectorAll` plus a forced
 * layout per drawn row), and two of the three ways a page can have NO landing
 * are answerable without touching the DOM at all. A page drawn inside what
 * the hand is holding has none by construction; a page with no row of the
 * carried file has none by the format. Both are ordinary — the second is the
 * cross-file drop this whole feature is about — and both used to pay for a
 * full sweep of a page whose every row was about to be thrown away.
 */
export const placeable = (
  field: Field,
  page: Element,
  file: string,
  held: ReadonlySet<string>,
): ReadonlyArray<Placed> => {
  // A page ZOOMED INTO something in the air offers nothing, and says so once
  // rather than per row: every row it draws is under that node, so the walk
  // below would reject all of them one at a time.
  if (field.within.some((id) => held.has(id))) return []
  // `airborne` and not a second reading of the same rule: what a row is
  // EXCLUDED for is exactly what makes it fade, so the affordance and the
  // candidate list cannot come from two opinions about one gesture.
  const candidates = flatten(field.rows(), field.collapsed()).filter((row) =>
    row.at.file === file && !airborne(held, row.key)
  )
  if (candidates.length === 0) return []
  const lines = new Map(measureLines(page).map((line) => [line.key, line]))
  return candidates.flatMap((row): ReadonlyArray<Placed> => {
    const line = lines.get(row.key)
    if (line === undefined) return []
    const shows = row.kind === "node" || row.kind === "mirror" ? row.shows : undefined
    return [{
      ...line,
      id: row.at.node.id,
      parent: row.at.node.parent ?? null,
      // A placement is not a parent; the node it SHOWS is, and only when that
      // node is in this file and is not itself in the air. Same rule, same
      // reason, as `move in`'s — with the loop the second pane can draw
      // (a mirror of what the hand is holding) closed by the same field.
      into: shows !== undefined && shows.file === file && !held.has(shows.node.id)
        ? shows.node.id
        : null,
      depth: depthOf(row.key),
    }]
  })
}
