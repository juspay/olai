/** The format setting names the active row used to mint new outlines. */
import { serviceTag } from "@olai/plugin-api/services"
import { Effect, Schema } from "effect"

export const Config = Schema.Struct({
  format: Schema.String.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("olai" as const)),
    Schema.annotate({ description: "the file-kind row used to create new outlines" }),
  ),
})
export type Config = typeof Config.Type

/** The main component owns decoded row config; file access declares this
 * dependency rather than reaching into another activation. */
export const OutlineRow = serviceTag<string>("vault.outline-row")
