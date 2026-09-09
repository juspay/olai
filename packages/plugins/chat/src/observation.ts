import { Schema } from "effect"

/** Content-free delivery evidence. This contract does not choose a transport,
 * own a subscription, or acknowledge delivery to a person. */
export const ChatObservation = Schema.Struct({
  view: Schema.String,
  session: Schema.NullOr(Schema.String),
  stage: Schema.Literals(["applied", "rendered", "transcript", "saying", "order", "tail"]),
  source: Schema.Literals(["snapshot", "delta", "dom", "stream"]),
  phase: Schema.Literals(["started", "completed", "continued", "fold_failed", "stream_failed"]),
  compaction: Schema.NullOr(Schema.String),
  row: Schema.NullOr(Schema.String),
  following: Schema.optionalKey(Schema.Boolean),
  atBottom: Schema.optionalKey(Schema.Boolean),
  inViewport: Schema.optionalKey(Schema.Boolean),
  visibility: Schema.String,
})
export type ChatObservation = typeof ChatObservation.Type

export interface ViewportObservation {
  readonly following: boolean
  readonly atBottom: boolean
  readonly inViewport: boolean
}
