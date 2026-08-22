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

/**
 * What `GET /olai/who` answers with, when somebody is looking. 204 otherwise.
 *
 * ONE READING, and it is the server's: which picture a person wears is
 * resolved there, down `@olai/identity`'s ladder (a picture header, an
 * avatar template, the gravatar of a real email claim), because header
 * names and templates are the operator's config and a browser has no
 * business knowing either. What arrives here is the answer.
 */
export const Who = Schema.Struct({
  login: Schema.String,
  /** What to CALL this person — the proxy's display name, or `null`, and
   *  then the login is what the chip says. */
  name: Schema.NullOr(Schema.String),
  /** The picture to draw, already resolved — or `null`, which is the
   *  silhouette the chip draws itself and needs no network for. */
  picture: Schema.NullOr(Schema.String),
})
export type Who = typeof Who.Type
