import { Schema } from "effect"

export const DocumentEntry = Schema.Union([
  Schema.Struct({ rev: Schema.Int, state: Schema.Literal("served"), text: Schema.String }),
  Schema.Struct({ rev: Schema.Int, state: Schema.Literal("refused") }),
])
export type DocumentEntry = typeof DocumentEntry.Type
