import { createHash, randomBytes } from "node:crypto"

import type { MailRefusal } from "./wire.ts"
import { SCOPE } from "./wire.ts"

export interface Endpoints {
  readonly authorize: string
  readonly token: string
  readonly revoke: string
}

export const GOOGLE: Endpoints = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
}

export const endpointsAt = (origin: string): Endpoints => ({
  authorize: `${origin}/o/oauth2/v2/auth`,
  token: `${origin}/token`,
  revoke: `${origin}/revoke`,
})

export type Google =
  | { readonly kind: "endpoints"; readonly endpoints: Endpoints }
  | { readonly kind: "refused"; readonly reason: string }

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

// Every value here is base64url without padding (RFC 7636 §A, and Google's own
// examples).
export const base64url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

// RFC 7636 §4.1 allows 43–128 characters; thirty-two bytes is 43 of them.
export const verifierOf = (bytes: Uint8Array): string => base64url(bytes)

// RFC 7636 §4.2: `BASE64URL(SHA256(ASCII(verifier)))`.
export const challengeOf = (verifier: string): string =>
  base64url(new Uint8Array(createHash("sha256").update(verifier, "ascii").digest()))

export const newVerifier = (): string => verifierOf(randomBytes(32))

export const newState = (): string => base64url(randomBytes(16))

// `access_type=offline` and `prompt=consent` TOGETHER are what make Google hand
// back a refresh token: offline alone is answered with one only on the first
// consent, consent alone with none at all.
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

export interface Request {
  readonly url: string
  readonly body: string
}

export const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded"

const composed = (url: string, fields: Record<string, string>): Request => ({
  url,
  body: new URLSearchParams(fields).toString(),
})

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

export const revokeRequest = (endpoints: Endpoints, refreshToken: string): Request =>
  composed(endpoints.revoke, { token: refreshToken })

export interface Tokens {
  readonly accessToken: string
  // Google sends a refresh token on the authorization-code exchange, and on a
  // refresh only when it rotates one; `null` means keep the stored one.
  readonly refreshToken: string | null
  readonly expiresIn: number
  readonly scope: string | null
}

export type Answer =
  | { readonly ok: true; readonly tokens: Tokens }
  | { readonly ok: false; readonly kind: "verdict" | "transient"; readonly error: string; readonly description: string | null }

const word = (value: unknown, fallback: string): string => typeof value === "string" && value !== "" ? value : fallback

export const tokenAnswer = (status: number, body: string): Answer => {
  let said: unknown
  try {
    said = JSON.parse(body)
  } catch {
    return { ok: false, kind: "transient", error: `HTTP ${status}`, description: body.trim().slice(0, 200) || null }
  }
  const record = (typeof said === "object" && said !== null ? said : {}) as Record<string, unknown>
  const failure = record["error"]
  if (status >= 400 || typeof failure === "string") {
    return {
      ok: false,
      kind: status >= 400 && status < 500 && typeof failure === "string" ? "verdict" : "transient",
      error: word(failure, `HTTP ${status}`),
      description: typeof record["error_description"] === "string" ? record["error_description"] : null,
    }
  }
  const access = record["access_token"]
  if (typeof access !== "string" || access === "") {
    return { ok: false, kind: "transient", error: "no-access-token", description: `the token endpoint answered ${status} without an access token` }
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
