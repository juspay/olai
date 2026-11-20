import { BrokenFile, Face, Located } from "@olai/format"
import { Schema } from "effect"

export const OutlineEntry = Schema.Struct({
  rev: Schema.Int,
  nodes: Schema.Array(Located),
  broken: Schema.NullOr(BrokenFile),
  face: Face,
})
export type OutlineEntry = typeof OutlineEntry.Type
