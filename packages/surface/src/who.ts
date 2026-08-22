/**
 * Who is looking — the JSON both doors carry, and the HTTP path the
 * plain-HTTP door still answers at.
 *
 * Identity is per CONNECTION (the upgrade is that request), not one value
 * for the process, so it is a PROCEDURE (`who.get`) rather than a cell.
 * The chip asks that; `GET /olai/who` stays for a share sheet and a
 * script, which have no websocket. The two live in packages that cannot
 * import each other, so the path and the JSON are declared here, the way
 * `/media/…` is, rather than copied.
 *
 * A second spelling of the JSON is a chip that cannot draw what the
 * server answered.
 */

import { Schema } from "effect"

export const WHO_PATH = "/olai/who"

/**
 * Who is looking, when somebody is. `null` (the procedure) or 204 (the
 * HTTP door) otherwise.
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
