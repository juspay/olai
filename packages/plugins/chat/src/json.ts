import { Schema } from "effect"
/** JSON values preserve their payload keys and have no undefined wire values. */
export const Json = Schema.Json
export type Json = typeof Json.Type
