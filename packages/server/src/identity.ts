/**
 * `GET /olai/who` — this request's {@link identityOf}, as JSON, or 204
 * when nobody said. THE chip's door, and the same function a later
 * `POST /capture` will call on its own request. HTTP rather than a
 * surface member: the value is per REQUEST, and a cell is one value for
 * the process. The websocket cannot see it without kolu handing upgrade
 * headers through.
 *
 * The PERSON is `@olai/identity`. This file is the door: it maps that
 * value onto `@olai/surface`'s `Who` and serves it. A second reading of
 * the headers here would be the parse the package exists to have stopped
 * keeping — and so would a second picture rule: WHICH picture is
 * `pictureOf`'s ladder, resolved HERE rather than in the browser, because
 * header names and the avatar template are the operator's config and a
 * page has no business knowing either.
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
import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** The chip's value of one identity — the login, what to call them, and
 *  the picture the ladder resolved (or none, which is the silhouette). */
export const shown = (who: Identity, avatar: string | null): Who => ({
  login: who.login,
  name: who.name,
  picture: pictureOf(who, avatar),
})

export const whoRoute = (identity: IdentityConfig) =>
  HttpRouter.add(
    "GET",
    WHO_PATH,
    (request: HttpServerRequest.HttpServerRequest) => {
      const who = identityOf(request.headers, identity.headers)
      if (who === null) {
        return Effect.succeed(HttpServerResponse.empty({ status: 204 }))
      }
      return Effect.orDie(HttpServerResponse.json(shown(who, identity.avatar)))
    },
  )
