import { expect, test } from "bun:test"

import { SCOPE } from "./wire.ts"
import {
  authorizationUrl,
  base64url,
  challengeOf,
  endpointsAt,
  GOOGLE,
  googleOf,
  LOOPBACK_ONLY,
  parseCallback,
  refreshRequest,
  revokeRequest,
  tokenAnswer,
  verifierOf,
} from "./oauth.ts"

/** RFC 7636 appendix B's own worked example, which is what makes the S256
 *  arithmetic checkable without a browser: the verifier in, the challenge the
 *  spec prints out. */
test("S256 is the RFC's own worked example", () => {
  expect(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
})

test("a verifier is 43 base64url characters of the bytes it was given", () => {
  const verifier = verifierOf(new Uint8Array(32).fill(7))
  expect(verifier).toHaveLength(43)
  expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
})

test("padding and the two URL-unsafe characters are the base64url alphabet", () => {
  // 0xfb 0xff is `+/` in standard base64 and `-_` here; 0x01 alone pads.
  expect(base64url(new Uint8Array([0xfb, 0xff]))).toBe("-_8")
  expect(base64url(new Uint8Array([0x01]))).toBe("AQ")
})

test("the authorization URL asks for what the consent screen has to show", () => {
  const url = new URL(authorizationUrl(GOOGLE, {
    client: "cid.apps.googleusercontent.com",
    redirect: "https://olai.example/_olai/mail/oauth",
    state: "st-1",
    challenge: "ch-1",
  }))
  expect(url.origin + url.pathname).toBe(GOOGLE.authorize)
  const query = url.searchParams
  expect(query.get("response_type")).toBe("code")
  expect(query.get("client_id")).toBe("cid.apps.googleusercontent.com")
  expect(query.get("redirect_uri")).toBe("https://olai.example/_olai/mail/oauth")
  expect(query.get("scope")).toBe(SCOPE)
  // Offline AND consent together: offline alone is answered with a refresh token
  // only on a first consent, consent alone with no refresh token at all.
  expect(query.get("access_type")).toBe("offline")
  expect(query.get("prompt")).toBe("consent")
  expect(query.get("state")).toBe("st-1")
  expect(query.get("code_challenge")).toBe("ch-1")
  expect(query.get("code_challenge_method")).toBe("S256")
})

test("the endpoints are Google's unless an origin was named, and one origin when it was", () => {
  expect(googleOf(undefined)).toEqual({ kind: "endpoints", endpoints: GOOGLE })
  expect(googleOf("  ")).toEqual({ kind: "endpoints", endpoints: GOOGLE })
  expect(googleOf("http://127.0.0.1:4321")).toEqual({ kind: "endpoints", endpoints: endpointsAt("http://127.0.0.1:4321") })
  expect(googleOf("http://localhost:1")).toEqual({ kind: "endpoints", endpoints: endpointsAt("http://localhost:1") })
})

test("only a loopback origin is honoured, because the POSTs carry the secret", () => {
  // Every one of these would send the client secret and the refresh token to
  // whoever owns the origin, so a deployment may not name any of them.
  for (const origin of [
    "https://accounts.example",
    "https://accounts.google.com",
    "http://127.0.0.1.evil.example:8080",
    "http://127.0.0.1:4321/o/oauth2/v2/auth",
    "not a url",
  ]) {
    expect(googleOf(origin), origin).toEqual({ kind: "refused", reason: LOOPBACK_ONLY })
  }
})

test("a callback carries the code and the state, or Google's refusal", () => {
  expect(parseCallback("/_olai/mail/oauth?code=c-1&state=st-1"))
    .toEqual({ kind: "code", code: "c-1", state: "st-1" })
  expect(parseCallback("/_olai/mail/oauth?code=c-1")).toEqual({ kind: "refused", reason: "the callback carried no authorization code" })
  expect(parseCallback("/_olai/mail/oauth?state=st-1")).toEqual({ kind: "refused", reason: "the callback carried no authorization code" })
  expect(parseCallback("/_olai/mail/oauth?error=access_denied&error_description=the+user+said+no"))
    .toEqual({ kind: "refused", reason: "access_denied: the user said no" })
  expect(parseCallback("/_olai/mail/oauth?error=access_denied")).toEqual({ kind: "refused", reason: "access_denied" })
})

test("the exchange is a form body carrying the verifier, the refresh is not", () => {
  const exchange = refreshRequest(GOOGLE, { client: "cid", secret: "sec", refreshToken: "rt" })
  const query = new URLSearchParams(exchange.body)
  expect(exchange.url).toBe(GOOGLE.token)
  expect(query.get("grant_type")).toBe("refresh_token")
  expect(query.get("client_id")).toBe("cid")
  expect(query.get("client_secret")).toBe("sec")
  expect(query.get("refresh_token")).toBe("rt")
  expect(query.get("code_verifier")).toBeNull()
  expect(query.get("redirect_uri")).toBeNull()

  const revoke = revokeRequest(GOOGLE, "rt")
  expect(revoke.url).toBe(GOOGLE.revoke)
  expect(new URLSearchParams(revoke.body).get("token")).toBe("rt")
})

test("a token answer is read on both arms", () => {
  expect(tokenAnswer(200, JSON.stringify({
    access_token: "at",
    refresh_token: "rt",
    expires_in: 3599,
    scope: SCOPE,
  }))).toEqual({
    ok: true,
    tokens: { accessToken: "at", refreshToken: "rt", expiresIn: 3599, scope: SCOPE },
  })
  // Google rotates a refresh token only sometimes; an answer without one means
  // the record's own is still the one to use.
  expect(tokenAnswer(200, JSON.stringify({ access_token: "at" }))).toEqual({
    ok: true,
    tokens: { accessToken: "at", refreshToken: null, expiresIn: 3600, scope: null },
  })
  // The fault arm the plugin branches on, with Google's own word kept whole.
  // ...and a WORD on a 4xx is a verdict rather than a retry: only a person can
  // replace a grant Google has revoked.
  expect(tokenAnswer(400, JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." })))
    .toEqual({ ok: false, error: "invalid_grant", description: "Token has been expired or revoked.", retry: false })
  // A 200 with nothing usable is not a success either.
  expect(tokenAnswer(200, JSON.stringify({ token_type: "Bearer" })))
    .toEqual({ ok: false, error: "no-access-token", description: "the token endpoint answered 200 without an access token", retry: true })
  // ...and neither is a body that is not JSON at all — a proxy's HTML error
  // page, which is the world rather than a verdict.
  expect(tokenAnswer(502, "<html>bad gateway</html>"))
    .toEqual({ ok: false, error: "HTTP 502", description: "<html>bad gateway</html>", retry: true })
  // A 4xx with no word in it is the world too.
  expect(tokenAnswer(400, "{}")).toEqual({ ok: false, error: "HTTP 400", description: null, retry: true })
  // A 5xx that DID carry a word is still the world: Google's own words about a
  // grant arrive on 4xx.
  expect(tokenAnswer(503, JSON.stringify({ error: "backend_error" })))
    .toEqual({ ok: false, error: "backend_error", description: null, retry: true })
})
