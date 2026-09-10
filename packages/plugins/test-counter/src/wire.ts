/** Deliberately no Olai domain types: the same capability is served headless
 * and rendered in a tiny shell by ordinary host composition. */
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
export const name = "test-counter"
export const surface = defineSurface({ procedures: {
  counter: {
    read: { input: Schema.Struct({}), output: Schema.Number },
    increment: { input: Schema.Struct({}), output: Schema.Number },
  },
} })
export const faces = {
  browser: { "counter.read": "tool", "counter.increment": "tool" },
  agent: { "counter.read": "tool", "counter.increment": "tool" },
} as const
