import { Schema } from "effect"

export const WHO_PATH = "/olai/who"

export const Who = Schema.Struct({
  login: Schema.String,
  name: Schema.NullOr(Schema.String),
  picture: Schema.NullOr(Schema.String),
})
export type Who = typeof Who.Type
