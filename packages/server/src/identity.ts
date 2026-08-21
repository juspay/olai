/**
 * Who this CONNECTION is — the Tailscale login on the request, or nobody.
 *
 * `tailscale serve` injects `Tailscale-User-Login` on every proxied request.
 * Direct access and a local `just run` do not, and that absence is a state:
 * nothing here invents a person. {@link identityOf} is the one reading of
 * that header. The header chip asks `GET /olai/who`; a later HTTP door
 * (`POST /capture`) asks the same function of its own request. Two callers,
 * one answer, so attribution and the chip cannot disagree about who landed.
 *
 * It is NOT a cell. Cells are one value for the process; this value is one
 * value for the REQUEST. Putting it on `git`'s kind of member would
 * publish the last tab's login to every other tab.
 *
 * PROCESS identity is a different question, already answered:
 * `surface/system/identity` is which olai this tab is bound to, and a
 * member of our own for that was withdrawn (juspay/kolu#2133). This file
 * is the person on the connection, not the process serving it.
 *
 * The gravatar is a remote `<img>`. The app page admits that origin in the
 * shell (`packages/web/src/client/index.html`'s content policy); sealed
 * `/media` pages keep their own, stricter, policy and do not.
 */

import { createHash } from "node:crypto"
import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/**
 * The header `tailscale serve` injects. Node lowercases incoming names, so
 * every lookup goes through this spelling; the canonical Tailscale name is
 * `Tailscale-User-Login`.
 */
export const LOGIN_HEADER = "tailscale-user-login"

/** Where a gravatar is fetched from. Named once: the URL {@link gravatarOf}
 *  writes, and the shell's image policy names the same origin. */
export const GRAVATAR_ORIGIN = "https://www.gravatar.com"

/** The login `tailscale serve` wrote, and nothing else. Attribution reads
 *  this; the gravatar URL is a display of it, derived beside it. */
export interface Identity {
  readonly login: string
}

/** What the chip draws: the login, and the gravatar derived from it. */
export interface Who {
  readonly login: string
  readonly gravatar: string
}

/** Where the chip asks. Named once: the client fetches the same path. */
export const WHO_PATH = "/olai/who"

/**
 * Who this request is, or `null` when nobody said.
 *
 * THE SEAM. Trimmed, and empty after trim is absent — a header that is
 * present and blank is how a proxy that meant to strip one still sends it.
 * An array is the first value, which is what a doubled injection is rather
 * than a list of people. Nothing here guesses a local user, an env var, or
 * git's `user.email`.
 */
export const identityOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
): Identity | null => {
  const raw = headers[LOGIN_HEADER] ?? headers["Tailscale-User-Login"]
  const value = Array.isArray(raw) ? raw[0] : raw
  const login = value?.trim() ?? ""
  return login === "" ? null : { login }
}

/**
 * The gravatar for a login email: MD5 of the trimmed, lowercased address,
 * with Gravatar's mystery-person fallback when that address has no image.
 * The hash is the classic Gravatar contract; the `d=mp` is the generic
 * silhouette the chip draws when there is none.
 */
export const gravatarOf = (login: string): string => {
  const hash = createHash("md5")
    .update(login.trim().toLowerCase())
    .digest("hex")
  return `${GRAVATAR_ORIGIN}/avatar/${hash}?d=mp`
}

/** The chip's value of one identity — the login, and the picture derived
 *  from it. Derived here so a browser does not have to hash, and so the
 *  algorithm lives next to the header it is read from. */
export const shown = (who: Identity): Who => ({
  login: who.login,
  gravatar: gravatarOf(who.login),
})

/**
 * `GET /olai/who` — this request's {@link identityOf}, as JSON, or 204
 * when nobody said. THE chip's door, and the same function a later
 * `POST /capture` will call on its own request. HTTP rather than a
 * surface member: the value is per REQUEST, and a cell is one value for
 * the process.
 */
export const whoRoute = () =>
  HttpRouter.add(
    "GET",
    WHO_PATH,
    (request: HttpServerRequest.HttpServerRequest) => {
      const who = identityOf(request.headers)
      if (who === null) {
        return Effect.succeed(HttpServerResponse.empty({ status: 204 }))
      }
      return Effect.orDie(HttpServerResponse.json(shown(who)))
    },
  )
