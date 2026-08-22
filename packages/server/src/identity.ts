/**
 * `GET /olai/who` — this request's {@link identityOf}, as JSON, or 204
 * when nobody said. THE chip's door, and the same function a later
 * `POST /capture` will call on its own request. HTTP rather than a
 * surface member: the value is per REQUEST, and a cell is one value for
 * the process. The websocket cannot see it without kolu handing upgrade
 * headers through.
 *
 * The PERSON is `@olai/identity`. This file is the door: it maps that
 * value onto `@olai/surface`'s `Who` (login + gravatar URL) and serves
 * it. A second reading of the headers here would be the parse the
 * package exists to have stopped keeping.
 *
 * The gravatar is a remote `<img>`. The app page admits that origin in the
 * shell (`packages/web/src/client/index.html`'s content policy); sealed
 * `/media` pages keep their own, stricter, policy and do not.
 */

import {
  GENERIC_GRAVATAR,
  gravatarOf,
  identityOf,
  type Identity,
  type IdentityHeaders,
} from "@olai/identity"
import { WHO_PATH, type Who } from "@olai/surface"
import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** The chip's value of one identity — the login, and the picture from the
 *  email claim (or {@link GENERIC_GRAVATAR}). */
export const shown = (who: Identity): Who => ({
  login: who.login,
  gravatar: who.email === null ? GENERIC_GRAVATAR : gravatarOf(who.email),
})

export const whoRoute = (names: IdentityHeaders) =>
  HttpRouter.add(
    "GET",
    WHO_PATH,
    (request: HttpServerRequest.HttpServerRequest) => {
      const who = identityOf(request.headers, names)
      if (who === null) {
        return Effect.succeed(HttpServerResponse.empty({ status: 204 }))
      }
      return Effect.orDie(HttpServerResponse.json(shown(who)))
    },
  )
