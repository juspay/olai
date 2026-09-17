/**
 * THE OAUTH FLOW, AS SHAPES — every URL, every form body, and the parse of
 * every answer, with no I/O anywhere in the file.
 *
 * ## Why this is a module of its own
 *
 * The flow has four moving parts (an authorization URL, a code-for-tokens
 * exchange, a refresh, a revoke), each of them a string this repo has to get
 * exactly right against a service it cannot ask twice, and each of them
 * reachable only through a browser redirect or a network round trip. Written
 * inline in the account machine they would be testable only by running the
 * machine, against a fake, through the wire — which is how a typo in
 * `access_type=offline` survives to a person's consent screen. Here they are
 * functions of their arguments, and `oauth.test.ts` holds each of them to the
 * words Google documents without a socket.
 *
 * The one thing this file deliberately does NOT do is decide anything about the
 * account: which arm a failure is, what the row says, whether the token is worth
 * keeping. That is the state machine's (`../account.ts`), and keeping the
 * decisions out of here is what lets this module be read as a description of the
 * protocol.
 *
 * ## The endpoints, and the one variable that moves them — LOOPBACK ONLY
 *
 * `OLAI_MAIL_GOOGLE` is the Google ORIGIN, and unset means Google: authorize at
 * `accounts.google.com`, exchange, refresh and revoke at `oauth2.googleapis.com`.
 * Set — which only the e2e harness does, pointing all three at its fake — it is
 * one origin serving `/o/oauth2/v2/auth`, `/token` and `/revoke`, so a scenario
 * exercises the flow this plugin has rather than a mock of it.
 *
 * IT IS A DOOR ANY DEPLOYMENT CAN OPEN, and the sharpest one in this plugin,
 * which is why {@link googleOf} closes it: the POSTs it redirects carry the
 * client secret and the refresh token, so an `environmentFile` that named a
 * foreign origin would hand both to whoever owns it. Only a LOOPBACK origin is
 * honoured; anything else is a fault on the row naming that ruling. #606's own
 * words for this variable are *"the one thing that sets the path to something
 * else"* — the harness — and a loopback check is what makes that true rather
 * than a promise.
 *
 * ## PKCE, and why the verifier is derivable from bytes
 *
 * The challenge is S256 of a 43–128 character verifier, and the verifier must
 * be UNGUESSABLE — so the production path takes it from the platform's random
 * source and the test path takes it from bytes the test chose. That is the whole
 * of why {@link verifierOf} and {@link challengeOf} are separate from
 * {@link newVerifier}: the arithmetic is what can be wrong, and it is the part
 * that needs no entropy to check.
 */

import { createHash, randomBytes } from "node:crypto"

import type { MailRefusal } from "./wire.ts"
import { SCOPE } from "./wire.ts"

/** The three endpoints the flow spends. */
export interface Endpoints {
  readonly authorize: string
  readonly token: string
  readonly revoke: string
}

/** THE REAL ONES, and the defaults a serve with no `OLAI_MAIL_GOOGLE` uses. */
export const GOOGLE: Endpoints = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
}

/** ...and the same three on one origin, for the harness's fake. */
export const endpointsAt = (origin: string): Endpoints => ({
  authorize: `${origin}/o/oauth2/v2/auth`,
  token: `${origin}/token`,
  revoke: `${origin}/revoke`,
})

/**
 * WHAT THIS SERVE TALKS TO, decided once at activation.
 *
 * A refusal rather than a thrown error, because the row has to be able to SAY
 * it: the serve still boots, the plugin still stands, and the pill reports the
 * reason. That is the same shape a missing binary and unset doors take.
 */
export type Google =
  | { readonly kind: "endpoints"; readonly endpoints: Endpoints }
  | { readonly kind: "refused"; readonly reason: string }

/** What a serve that named somewhere other than loopback is told. */
export const LOOPBACK_ONLY =
  "OLAI_MAIL_GOOGLE may only name a loopback origin — this serve posts its OAuth client secret and its Gmail refresh token to whatever origin it names, so a deployment may not point it anywhere."

const isLoopback = (hostname: string): boolean =>
  hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1"

export const googleOf = (google: string | undefined): Google => {
  const named = google?.trim() ?? ""
  if (named === "") return { kind: "endpoints", endpoints: GOOGLE }
  const parsed = (() => {
    try {
      return new URL(named)
    } catch {
      return null
    }
  })()
  if (parsed === null || !isLoopback(parsed.hostname) || parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
    return { kind: "refused", reason: LOOPBACK_ONLY }
  }
  return { kind: "endpoints", endpoints: endpointsAt(parsed.origin) }
}

/** `base64url` without padding, which is what every one of these values is
 *  spelled in (RFC 7636 §A and Google's own examples). */
export const base64url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

/** A verifier from thirty-two bytes of whatever the caller has: 43 base64url
 *  characters, inside the 43–128 RFC 7636 §4.1 allows. */
export const verifierOf = (bytes: Uint8Array): string => base64url(bytes)

/** `BASE64URL(SHA256(ASCII(verifier)))` — RFC 7636 §4.2, and the method the
 *  authorization URL declares as `S256`. */
export const challengeOf = (verifier: string): string =>
  base64url(new Uint8Array(createHash("sha256").update(verifier, "ascii").digest()))

/** What the plugin actually connects with. */
export const newVerifier = (): string => verifierOf(randomBytes(32))

/** The `state` — random, single-use, and checked against the pending record. */
export const newState = (): string => base64url(randomBytes(16))

/**
 * THE AUTHORIZATION URL — what the Connect button opens.
 *
 * Four parameters are here that a minimal flow does not need, and each is a
 * decision rather than a convenience:
 *
 *   - `access_type=offline` and `prompt=consent` TOGETHER are what make Google
 *     hand back a refresh token. Offline alone is answered with a refresh token
 *     only on the first consent; consent alone renews an access token and no
 *     refresh token at all. A serve that lost its refresh token would be a
 *     serve asking a person to press Connect again, which is the failure this
 *     pair exists to prevent — and the cost is that a reconnect always shows a
 *     consent screen, which is the honest thing for a reconnect to show.
 *   - `scope` is the RULING (`../wire.ts`): modify, and no permanent delete.
 *   - `code_challenge_method=S256` and the challenge, so the code that comes
 *     back to a loopback serve is worthless to anyone who reads it.
 */
export const authorizationUrl = (
  endpoints: Endpoints,
  input: {
    readonly client: string
    readonly redirect: string
    readonly state: string
    readonly challenge: string
  },
): string => {
  const query = new URLSearchParams({
    client_id: input.client,
    redirect_uri: input.redirect,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  })
  return `${endpoints.authorize}?${query.toString()}`
}

/**
 * WHAT THE CALLBACK CARRIES — the code and the state, or Google's refusal.
 *
 * Both arms are addresses a person can land on with a bookmark, a stale tab or
 * a hostile link, so this parses rather than trusts: a missing `code`, a
 * `state` that does not match the pending one (compared by the caller, which is
 * the only party that knows what it minted), or an `error` all arrive here and
 * none of them throws.
 */
export type Callback =
  | { readonly kind: "code"; readonly code: string; readonly state: string }
  | { readonly kind: "refused"; readonly reason: string }

export const parseCallback = (url: string): Callback => {
  const query = new URL(url, "http://localhost").searchParams
  const refused = query.get("error")
  if (refused !== null && refused !== "") {
    const detail = query.get("error_description")
    return { kind: "refused", reason: detail === null || detail === "" ? refused : `${refused}: ${detail}` }
  }
  const code = query.get("code")
  const state = query.get("state")
  if (code === null || code === "" || state === null || state === "") {
    return { kind: "refused", reason: "the callback carried no authorization code" }
  }
  return { kind: "code", code, state }
}

/** One request to the token or revoke endpoint: where, and what to POST. The
 *  header is not here because it is the same for all three and the caller
 *  writes it once (`FORM_CONTENT_TYPE`). */
export interface Request {
  readonly url: string
  readonly body: string
}

export const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"

const composed = (url: string, fields: Record<string, string>): Request => ({
  url,
  body: new URLSearchParams(fields).toString(),
})

/** The code-for-tokens exchange. `client_secret` is sent because the OAuth
 *  client this product registers is a *Web application* — the one kind Google
 *  issues a secret for — and PKCE rides along as well, which costs nothing and
 *  covers the case where a code leaks from the redirect. */
export const exchangeRequest = (
  endpoints: Endpoints,
  input: {
    readonly client: string
    readonly secret: string
    readonly code: string
    readonly redirect: string
    readonly verifier: string
  },
): Request =>
  composed(endpoints.token, {
    grant_type: "authorization_code",
    client_id: input.client,
    client_secret: input.secret,
    code: input.code,
    redirect_uri: input.redirect,
    code_verifier: input.verifier,
  })

/** The refresh, which is the request this plugin makes for the rest of the
 *  account's life. No `redirect_uri` and no verifier: there is no browser in
 *  this leg and no authorization code to redeem. */
export const refreshRequest = (
  endpoints: Endpoints,
  input: { readonly client: string; readonly secret: string; readonly refreshToken: string },
): Request =>
  composed(endpoints.token, {
    grant_type: "refresh_token",
    client_id: input.client,
    client_secret: input.secret,
    refresh_token: input.refreshToken,
  })

/** ...and the disconnect. Revoking the REFRESH token revokes every access token
 *  minted from it, which is what "Disconnect" means to the person pressing it;
 *  a fair-play revocation would also revoke the access token still in memory,
 *  and there is nothing left to spend it on once the record is gone. */
export const revokeRequest = (endpoints: Endpoints, refreshToken: string): Request =>
  composed(endpoints.revoke, { token: refreshToken })

export interface Tokens {
  readonly accessToken: string
  /** Google returns a refresh token on the authorization-code exchange (and on
   *  a refresh only when it decides to rotate one); `null` means *keep the one
   *  you have*. */
  readonly refreshToken: string | null
  /** Seconds, from the answer, defaulting to an hour when absent — the value
   *  the refresh fiber counts down from. */
  readonly expiresIn: number
  /** The scope actually granted, which a person may have narrowed at the
   *  consent screen and which the panel reports verbatim. */
  readonly scope: string | null
}

/**
 * WHAT THE TOKEN ENDPOINT ANSWERED, on both arms.
 *
 * Google answers a refused grant with HTTP 400 and
 * `{"error": "invalid_grant", "error_description": "…"}`, where `error` is a
 * word the panel shows and the machine branches on. A 200 without
 * `access_token` is not a success either, and is reported with the same
 * vocabulary rather than as a defect: the endpoint is a remote service and what
 * a remote service says is data.
 *
 * ## `retry` — WHICH REFUSALS ARE WORTH WAITING OUT
 *
 * A refused-grant answer is a person's to fix: only a fresh consent replaces it.
 * Everything else here — a transport failure, a 5xx, a body that is not JSON at
 * all (a proxy's HTML error page) — is the world being briefly broken, and
 * treating those as a fault would make a serve that booted while Google was
 * unreachable demand a full re-consent for a refresh token that is perfectly
 * valid. So the answer says which kind it is, and the machine
 * (`../account.ts`) retries one and hands the other to a person.
 */
export type Answer =
  | { readonly ok: true; readonly tokens: Tokens }
  | { readonly ok: false; readonly error: string; readonly description: string | null; readonly retry: boolean }

const word = (value: unknown, fallback: string): string => typeof value === "string" && value !== "" ? value : fallback

export const tokenAnswer = (status: number, body: string): Answer => {
  let said: unknown
  try {
    said = JSON.parse(body)
  } catch {
    return { ok: false, error: `HTTP ${status}`, description: body.trim().slice(0, 200) || null, retry: true }
  }
  const record = (typeof said === "object" && said !== null ? said : {}) as Record<string, unknown>
  const failure = record["error"]
  if (status >= 400 || typeof failure === "string") {
    return {
      ok: false,
      error: word(failure, `HTTP ${status}`),
      description: typeof record["error_description"] === "string" ? record["error_description"] : null,
      // A WORD from a 4xx is a verdict on the grant; a 5xx, a transport
      // failure (status 0, which `../account.ts` spells `unreachable`) and a
      // body with no word in it are the world, and the world comes back.
      retry: !(status >= 400 && status < 500 && typeof failure === "string"),
    }
  }
  const access = record["access_token"]
  if (typeof access !== "string" || access === "") {
    return { ok: false, error: "no-access-token", description: `the token endpoint answered ${status} without an access token`, retry: true }
  }
  const expires = record["expires_in"]
  return {
    ok: true,
    tokens: {
      accessToken: access,
      refreshToken: typeof record["refresh_token"] === "string" && record["refresh_token"] !== "" ? record["refresh_token"] : null,
      expiresIn: typeof expires === "number" && Number.isFinite(expires) ? expires : 3600,
      scope: typeof record["scope"] === "string" && record["scope"] !== "" ? record["scope"] : null,
    },
  }
}
