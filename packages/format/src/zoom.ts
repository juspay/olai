import { Schema } from "effect"

import {
  type Derived,
  follow,
  Row,
  rowsUnder,
  Situated,
  situate,
} from "./derive.ts"

export const Zoomed = Schema.Union([
  Schema.Struct({
    ...Situated.fields,
    kind: Schema.Literal("node"),
    children: Schema.Array(Row),
  }),
  Schema.Struct({ kind: Schema.Literal("unknown"), id: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("dangling"),
    id: Schema.String,
    missing: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("cycle"),
    id: Schema.String,
    through: Schema.String,
  }),
])
export type Zoomed = typeof Zoomed.Type

export const zoom = (derived: Derived, id: string): Zoomed => {
  const at = derived.byId.get(id)
  if (at === undefined) return { kind: "unknown", id }

  const found = follow(derived, at)
  if (found.kind === "dangling") return { kind: "dangling", id, missing: found.missing }
  if (found.kind === "cycle") return { kind: "cycle", id, through: found.through }

  const situated = situate(derived, found.shows)
  return {
    ...situated,
    kind: "node",
    children: rowsUnder(derived, situated.shows, situated.trail),
  }
}
