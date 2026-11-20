import { Effect, Schema } from "effect"

/** The server still holds every served PATH and validates every declared `doc`
 * property against it (`website/docs/format.md`). */
export const DocumentEntry = Schema.Struct({
  rev: Schema.Int,
  text: Schema.NullOr(Schema.String),
  refused: Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
})
export type DocumentEntry = typeof DocumentEntry.Type
