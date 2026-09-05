/** The vault row selects the codec; directory acquisition knows no format.
 * Adding a supported format extends this catalogue and its codec table. There
 * is deliberately no Org value until an Org implementation can read and write
 * the same operations the rest of the application speaks. */
import { codecFor } from "@olai/ops"
import { Schema } from "effect"

export const FORMATS = ["olai"] as const
export const Config = Schema.Struct({ format: Schema.Literals(FORMATS) })
export type Config = typeof Config.Type
export const codecs = { olai: codecFor } satisfies Record<Config["format"], typeof codecFor>
