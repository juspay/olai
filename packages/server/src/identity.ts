/**
 * Who this REQUEST is — a login the reverse proxy injected, or nobody.
 *
 * One configurable pair of trusted header names (login + optional email).
 * The proxy in front writes them; olai reads them. Default wiring is
 * `tailscale serve`'s `Tailscale-User-Login` for both (that header IS the
 * email). The same pair covers Caddy + OAuth (`X-Auth-Request-User` /
 * `X-Auth-Request-Email`, or caddy-security's `X-Token-User-*`) and
 * Authelia / Pomerium (`Remote-User` / `Remote-Email`) — one feature, not
 * one per proxy. {@link identityHeaders} is the config; {@link identityOf}
 * is the reading. `GET /olai/who` is the chip's door over that function;
 * a later `POST /capture` calls the same function on its own request.
 *
 * Direct access and a local `just run` inject nothing, and that absence
 * is a state: nothing here invents a person.
 *
 * **Trust.** These headers are only meaningful when the proxy is the only
 * way in: olai bound to loopback or the tailnet, and the proxy stripping
 * client-supplied copies of the same names. Anything that can reach the
 * port can send them — the same bargain the rest of the unauthenticated
 * listener already takes. The names are not a credential.
 *
 * It is NOT a cell. Cells are one value for the process; this value is one
 * value for the REQUEST. The websocket cannot see it today: kolu's
 * `serveSurfaceApp` owns the upgrade and does not hand request headers to
 * the app. HTTP paths can (`GET /olai/who`, a later `/capture`).
 *
 * PROCESS identity is a different question, already answered:
 * `surface/system/identity` is which olai this tab is bound to
 * (juspay/kolu#2133). This file is the person on the request.
 *
 * The gravatar is a remote `<img>`. The app page admits that origin in the
 * shell (`packages/web/src/client/index.html`'s content policy); sealed
 * `/media` pages keep their own, stricter, policy and do not.
 */

import { WHO_PATH, type Who } from "@olai/surface"
import { createHash } from "node:crypto"
import { Effect } from "effect"
import { HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

/** Default login header: `tailscale serve` injects it. Canonical spelling;
 *  lookups are case-insensitive. */
export const DEFAULT_LOGIN_HEADER = "Tailscale-User-Login"

/** The login header's name. Unset is {@link DEFAULT_LOGIN_HEADER}. */
export const LOGIN_ENV = "OLAI_IDENTITY_LOGIN_HEADER"
/** The email header's name. Unset is the login header; empty is no email. */
export const EMAIL_ENV = "OLAI_IDENTITY_EMAIL_HEADER"

/** Where a gravatar is fetched from. Named once: the URL {@link gravatarOf}
 *  writes, and the shell's image policy names the same origin. */
export const GRAVATAR_ORIGIN = "https://www.gravatar.com"

/**
 * The two header names olai trusts for who is looking.
 *
 * `email` is `null` when the operator has turned the email claim off
 * (empty `OLAI_IDENTITY_EMAIL_HEADER`). Unset, it defaults to the login
 * name — Tailscale's login IS the email, so one name covers both.
 */
export interface IdentityHeaders {
  readonly login: string
  readonly email: string | null
}

/** Tailscale serve: one header, and it is the email. */
export const DEFAULT_IDENTITY_HEADERS: IdentityHeaders = {
  login: DEFAULT_LOGIN_HEADER,
  email: DEFAULT_LOGIN_HEADER,
}

/** The login the proxy wrote, and the email claim if it wrote one. */
export interface Identity {
  readonly login: string
  readonly email: string | null
}

const headerOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  name: string,
): string | null => {
  const raw = headers[name.toLowerCase()] ?? headers[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = value?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

/**
 * The configured header names, or the Tailscale default.
 *
 * `OLAI_IDENTITY_LOGIN_HEADER` names the login. Unset is
 * `Tailscale-User-Login`. `OLAI_IDENTITY_EMAIL_HEADER` names the email
 * claim: unset, the login header (Tailscale); empty, no email claim;
 * otherwise that name. Read on demand, not at import.
 */
export const identityHeaders = (): IdentityHeaders => {
  const login = process.env[LOGIN_ENV]?.trim() || DEFAULT_LOGIN_HEADER
  const asked = process.env[EMAIL_ENV]
  if (asked === undefined) return { login, email: login }
  const email = asked.trim()
  return { login, email: email === "" ? null : email }
}

/**
 * Who this request is, or `null` when nobody said.
 *
 * THE SEAM. Trimmed, and empty after trim is absent — a header that is
 * present and blank is how a proxy that meant to strip one still sends it.
 * An array is the first value, which is what a doubled injection is rather
 * than a list of people. Nothing here guesses a local user, an env var, or
 * git's `user.email`. The email claim is optional: missing, blank, or a
 * config that named no email header is `email: null`, and the chip draws
 * the generic gravatar.
 */
export const identityOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  names: IdentityHeaders = DEFAULT_IDENTITY_HEADERS,
): Identity | null => {
  const login = headerOf(headers, names.login)
  if (login === null) return null
  const email = names.email === null ? null : headerOf(headers, names.email)
  return { login, email }
}

/**
 * The gravatar for an email: MD5 of the trimmed, lowercased address, with
 * Gravatar's mystery-person fallback when that address has no image. The
 * hash is the classic Gravatar contract; the `d=mp` is the generic
 * silhouette. An empty address is that silhouette for everyone with no
 * email claim — one picture, not a hash of the login.
 */
export const gravatarOf = (email: string): string => {
  const hash = createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex")
  return `${GRAVATAR_ORIGIN}/avatar/${hash}?d=mp`
}

/** The generic silhouette, hashed from the empty address so every
 *  no-email claim draws the same picture. */
export const GENERIC_GRAVATAR = gravatarOf("")

/** The chip's value of one identity — the login, and the picture from the
 *  email claim (or {@link GENERIC_GRAVATAR}). */
export const shown = (who: Identity): Who => ({
  login: who.login,
  gravatar: who.email === null ? GENERIC_GRAVATAR : gravatarOf(who.email),
})

/**
 * `GET /olai/who` — this request's {@link identityOf}, as JSON, or 204
 * when nobody said. THE chip's door, and the same function a later
 * `POST /capture` will call on its own request. HTTP rather than a
 * surface member: the value is per REQUEST, and a cell is one value for
 * the process. The websocket cannot see it without kolu handing upgrade
 * headers through.
 */
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
