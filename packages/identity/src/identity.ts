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
 * is the reading.
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
 * No HTTP, no surface, no Effect. The chip's door and a later capture
 * door both import this. The picture of the person is {@link ./gravatar.ts}.
 */

/** Default login header: `tailscale serve` injects it. Canonical spelling;
 *  lookups are case-insensitive. */
export const DEFAULT_LOGIN_HEADER = "Tailscale-User-Login"

/** The login header's name. Unset is {@link DEFAULT_LOGIN_HEADER}. */
export const LOGIN_ENV = "OLAI_IDENTITY_LOGIN_HEADER"
/** The email header's name. Unset is the login header; empty is no email. */
export const EMAIL_ENV = "OLAI_IDENTITY_EMAIL_HEADER"

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
 * config that named no email header is `email: null`.
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
