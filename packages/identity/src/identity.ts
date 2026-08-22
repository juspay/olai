/**
 * Who this REQUEST is — a login the reverse proxy injected, or nobody.
 *
 * One configurable FAMILY of trusted header names: a login, and optionally
 * an email claim, a display name and a picture. The proxy in front writes
 * them; olai reads them. Default wiring is `tailscale serve`'s
 * `Tailscale-User-Login` / `Tailscale-User-Name` /
 * `Tailscale-User-Profile-Pic`. The same family covers Caddy + OAuth
 * (`X-Auth-Request-User` / `X-Auth-Request-Email` / `-Preferred-Username`,
 * or caddy-security's `X-Token-User-*`) and Authelia (`Remote-User` /
 * `Remote-Email` / `Remote-Name`) and Pomerium (`X-Pomerium-Claim-User` /
 * `X-Pomerium-Claim-Email` / `-Name` / `-Picture`) — one feature, not one
 * per proxy. Pomerium's signed `X-Pomerium-Jwt-Assertion` is a JWT, not a
 * login; olai reads the claim headers, not the assertion.
 * {@link identityOf} is the reading; WHICH names it is handed is the
 * operator's, read from the environment in {@link ./config.ts} and passed
 * in — nothing in this file touches `process.env`.
 *
 * **The login is not necessarily an email.** On a Google/Microsoft/Okta
 * tailnet `Tailscale-User-Login` is the address, which is why the email
 * claim defaults to the same header. On a GitHub- or passkey-backed one it
 * reads `srid@github` — Tailscale's own spelling of that account, correct
 * to display and not an address. Nothing here assumes either way; the
 * picture ladder ({@link ./picture.ts}) is where that distinction is
 * finally paid off.
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
 * door both import this. Which picture that person wears is
 * {@link ./picture.ts}; the whole of what the operator configured, in one
 * value, is {@link ./config.ts}.
 */

/** Default login header: `tailscale serve` injects it. Canonical spelling;
 *  lookups are case-insensitive. */
export const DEFAULT_LOGIN_HEADER = "Tailscale-User-Login"
/** Default display-name header — `tailscale serve` injects the IdP's own
 *  name for the person ("Ada Lovelace"). */
export const DEFAULT_NAME_HEADER = "Tailscale-User-Name"
/** Default picture header — `tailscale serve` injects the IdP's avatar URL,
 *  which is the best picture of a person anybody here has. */
export const DEFAULT_PICTURE_HEADER = "Tailscale-User-Profile-Pic"

/**
 * The header names olai trusts for who is looking.
 *
 * Each of the three beyond the login is `null` when the operator has
 * turned that claim off (an empty variable). `email` unset defaults to the
 * login name — on the tailnets where the login IS an address, one name
 * covers both — while `name` and `picture` unset are Tailscale's own
 * headers, which a proxy that does not send them simply never writes.
 */
export interface IdentityHeaders {
  readonly login: string
  readonly email: string | null
  readonly name: string | null
  readonly picture: string | null
}

/** Tailscale serve: the login, the same header as the email claim, and the
 *  two the IdP fills in. */
export const DEFAULT_IDENTITY_HEADERS: IdentityHeaders = {
  login: DEFAULT_LOGIN_HEADER,
  email: DEFAULT_LOGIN_HEADER,
  name: DEFAULT_NAME_HEADER,
  picture: DEFAULT_PICTURE_HEADER,
}

/** The login the proxy wrote, and whichever of the other three claims it
 *  wrote beside it. */
export interface Identity {
  readonly login: string
  readonly email: string | null
  /** What to CALL this person — the IdP's display name. `null` when the
   *  proxy sent none, and then the login is what the chip says. */
  readonly name: string | null
  /** A picture URL the proxy sent, the top rung of {@link ./picture.ts}'s
   *  ladder. `null` when it sent none. */
  readonly picture: string | null
}

const headerOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  name: string | null,
): string | null => {
  if (name === null) return null
  const raw = headers[name.toLowerCase()] ?? headers[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = value?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

/**
 * Who this request is, or `null` when nobody said.
 *
 * THE SEAM. Trimmed, and empty after trim is absent — a header that is
 * present and blank is how a proxy that meant to strip one still sends it.
 * An array is the first value, which is what a doubled injection is rather
 * than a list of people. Nothing here guesses a local user, an env var, or
 * git's `user.email`. The LOGIN is what makes someone present; the other
 * three are claims about them, each `null` when it was not sent or when
 * the config named no header for it.
 */
export const identityOf = (
  headers: {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
  },
  names: IdentityHeaders = DEFAULT_IDENTITY_HEADERS,
): Identity | null => {
  const login = headerOf(headers, names.login)
  if (login === null) return null
  return {
    login,
    email: headerOf(headers, names.email),
    name: headerOf(headers, names.name),
    picture: headerOf(headers, names.picture),
  }
}
