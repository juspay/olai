/**
 * THE READING, whole: headers in, a person out — or nobody.
 *
 * The two folds under it are the parse ({@link ./identity.ts}: which names
 * this deployment trusts, and what the request carried under them) and the
 * picture ladder ({@link ./picture.ts}: a proxy's avatar, an operator's
 * template, the gravatar of a claim that really is an address, or none).
 * This module is where they meet, and it is the whole of what the
 * `Identity` door hands over — so the chip in a browser, `GET /olai/who`
 * and a capture taken through `/mcp` cannot disagree about who is looking.
 *
 * It was `@olai/server`'s `identity.ts`, minus the HTTP: core kept the two
 * DOORS and the mapping between them, which meant core knew both that a
 * picture is resolved down a ladder and which rung a deployment is on.
 * Neither is core's business now — what core reads is a login, a name and
 * a picture URL, already settled.
 *
 * `Person` is `@olai/plugin-api`'s, which is also `@olai/surface`'s `Who`
 * field for field. It is spelled in the door rather than imported from the
 * surface for the reason the door's own header gives, and the agreement is
 * checked where both are in hand: core maps this answer onto `Who` in one
 * expression, and a drift between them is a type error there.
 */

import type { Person, RequestHeaders } from "@olai/plugin-api/services"

import type { IdentityConfig } from "./config.ts"
import { type Identity, identityOf } from "./identity.ts"
import { pictureOf } from "./picture.ts"

/** One identity as the chip is handed it — the login, what to call them,
 *  and the picture the ladder resolved (or none, which is the silhouette
 *  the chip draws itself and needs no network for). */
export const shown = (who: Identity, template: string | null): Person => ({
  login: who.login,
  name: who.name,
  picture: pictureOf(who, template),
})

/**
 * Who this request is, or `null` for nobody.
 *
 * `null` is the honest absence rather than a failure: a local `just run`,
 * a direct loopback call, a proxy that injects nothing. Nothing here
 * invents a person, and the chip has a face for exactly this.
 */
export const whoOf = (
  headers: RequestHeaders,
  config: IdentityConfig,
): Person | null => {
  const person = identityOf(headers, config.headers)
  return person === null ? null : shown(person, config.avatarTemplate)
}
