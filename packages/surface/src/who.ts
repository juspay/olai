/**
 * `GET /olai/who` — the one HTTP address that answers who is looking.
 *
 * Identity is not a surface member: a cell is one value for the process, and
 * this value is one value for the REQUEST. The chip fetches it, the server
 * answers it, and those two live in packages that cannot import each other.
 * So the path — and the JSON it carries — are declared here, the way
 * `/media/…` is, rather than copied.
 *
 * A second spelling of the path is a 404 on one end and a chip that never
 * appears on the other.
 */

import { Schema } from "effect"

export const WHO_PATH = "/olai/who"

/** What `GET /olai/who` answers with, when somebody is looking. 204 otherwise. */
export const Who = Schema.Struct({
  login: Schema.String,
  /** Gravatar URL derived from the email claim, or the generic silhouette
   *  when there is none. */
  gravatar: Schema.String,
})
export type Who = typeof Who.Type
