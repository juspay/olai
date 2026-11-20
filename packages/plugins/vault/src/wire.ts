import { BrokenFile, Face } from "@olai/format"
import { Schema } from "effect"

export const Head = Schema.Struct({
  rev: Schema.Int,
  face: Face,
  broken: Schema.NullOr(BrokenFile),
})
export type Head = typeof Head.Type

export const Manifest = Schema.NullOr(Schema.Struct({}))
export type Manifest = typeof Manifest.Type

export const LOADED: Manifest = {}


