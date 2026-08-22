/**
 * Who is looking, as this process serves it.
 *
 * TWO DOORS, one reading. `GET /olai/who` is the plain-HTTP door — a share
 * sheet, a script, anything without a websocket. `who.get` is the tab's
 * door, answered from the headers the upgrade carried. Both call
 * {@link whoOf}: `@olai/identity`'s parse, then the picture ladder, mapped
 * onto `@olai/surface`'s `Who`. A second reading here would be the parse
 * the package exists to have stopped keeping — and so would a second
 * picture rule: header names and the avatar template are the operator's
 * config and a page has no business knowing either.
 *
 * The per-connection service is what `who.get` yields. `serveSurfaceApp`'s
 * `services` layer provides it from the upgrade; a handler that required
 * it without that layer would be a boot-time hole, which is why the
 * listener always names the identity headers.
 *
 * A picture is a remote `<img>` on the app page, and its origin is the
 * operator's: an IdP's avatar host, a template's host, or gravatar. The
 * shell's image policy admits `https:` for exactly that reason
 * (`packages/web/src/client/index.html`, and `who/policy.test.ts` says
 * why); sealed `/media` pages keep their own, stricter, policy and do not.
 */

import {
  identityOf,
  pictureOf,
  type Identity,
  type IdentityConfig,
} from "@olai/identity"
import { WHO_PATH, type Who } from "@olai/surface"
import { Context, Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** Who this connection is, already resolved — or nobody. Provided per
 *  websocket by `serveSurfaceApp`'s `services` from the upgrade headers. */
export class CurrentWho extends Context.Service<CurrentWho, Who | null>()(
  "olai/CurrentWho",
) {}

/** The chip's value of one identity — the login, what to call them, and
 *  the picture the ladder resolved (or none, which is the silhouette). */
export const shown = (who: Identity, template: string | null): Who => ({
  login: who.login,
  name: who.name,
  picture: pictureOf(who, template),
})

/** The one reading both doors share: parse the headers this config trusts,
 *  then walk the ladder. `null` is nobody — a local `just run`, a proxy
 *  that injects nothing. */
export const whoOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  identity: IdentityConfig,
): Who | null => {
  const person = identityOf(headers, identity.headers)
  return person === null ? null : shown(person, identity.avatarTemplate)
}

export const whoRoute = (identity: IdentityConfig) =>
  HttpRouter.add(
    "GET",
    WHO_PATH,
    (request: HttpServerRequest.HttpServerRequest) => {
      const who = whoOf(request.headers, identity)
      if (who === null) {
        return Effect.succeed(HttpServerResponse.empty({ status: 204 }))
      }
      return Effect.orDie(HttpServerResponse.json(who))
    },
  )
