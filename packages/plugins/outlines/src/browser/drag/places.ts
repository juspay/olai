import { flatten } from "../edit/order.ts"
import { depthOf } from "../select/range.ts"
import { airborne } from "./air.ts"
import type { Field } from "./fields.ts"
import { measureLines } from "./lines.ts"
import type { Placed } from "./plan.ts"

export const placeable = (
  field: Field,
  page: Element,
  file: string,
  held: ReadonlySet<string>,
): ReadonlyArray<Placed> => {
  if (field.within.some((id) => held.has(id))) return []
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
      into: shows !== undefined && shows.file === file && !held.has(shows.node.id)
        ? shows.node.id
        : null,
      depth: depthOf(row.key),
    }]
  })
}
