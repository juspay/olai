import { createHash } from "node:crypto"
import { fixtureNamed, GOOGLES } from "./fixtures.ts"

const AUTHORIZE_PATH = "/o/oauth2/v2/auth"
const TOKEN_PATH = "/token"
const REVOKE_PATH = "/revoke"

/** `BASE64URL(SHA256(ASCII(verifier)))` — RFC 7636 §4.2, and the method the
 *  plugin's authorization URL declares as `S256`. */
const challengeOf = (verifier: string): string =>
  createHash("sha256")
    .update(verifier, "ascii")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

export interface FakeGoogleInput {
  readonly email: string
  readonly refresh?: "ok" | "invalid_grant"
  readonly accessToken?: string
  readonly expiresIn?: number
  readonly scope?: string
}

export interface GoogleRequest {
  readonly method: string
  readonly path: string
  readonly query: string
  readonly body: string
}

export interface FakeGoogle {
  readonly origin: string
  readonly rewrite: (next: FakeGoogleInput) => void
  readonly requests: () => ReadonlyArray<GoogleRequest>
  readonly revoked: () => ReadonlyArray<string>
  readonly issued: () => ReadonlyArray<string>
  readonly stop: () => Promise<void>
}

interface Grant {
  readonly challenge: string
  readonly client: string
  readonly redirect: string
  readonly scope: string
  spent: boolean
}

export const startFakeGoogle = async (name: string): Promise<FakeGoogleByName> => {
  const fake = await startFakeGoogleFor(fixtureNamed(GOOGLES, "Google", name))
  return {
    ...fake,
    rewrite: (next) => {
      fake.rewrite(fixtureNamed(GOOGLES, "Google", next))
    },
  }
}

export interface FakeGoogleByName extends Omit<FakeGoogle, "rewrite"> {
  readonly rewrite: (name: string) => void
}

export const startFakeGoogleFor = async (input: FakeGoogleInput): Promise<FakeGoogle> => {
  let fixture = input
  const rewrite = (next: FakeGoogleInput): void => {
    if (next.email.trim() === "") {
      throw new Error("fake-google: a fixture with no email has no account to consent as")
    }
    fixture = next
  }
  rewrite(input)
  let minted = 0
  const serial = (prefix: string): string => {
    minted += 1
    return `${prefix}${minted}`
  }
  const granted = new Map<string, Grant>()
  const requests: Array<GoogleRequest> = []
  const revoked: Array<string> = []
  const issued: Array<string> = []

  const refuses = (said: string): Response =>
    Response.json(
      { error: "invalid_request", error_description: `fake-google: the consent screen for ${fixture.email} ${said}` },
      { status: 400 },
    )

  const invalidGrant = (why: string): Response =>
    Response.json(
      { error: "invalid_grant", error_description: `fake-google: ${why}` },
      { status: 400 },
    )

  const consent = (url: URL): Response => {
    const query = url.searchParams
    const missing = ["client_id", "redirect_uri", "state", "code_challenge"].filter((name) => (query.get(name) ?? "") === "")
    if (missing.length > 0) {
      return refuses(`was given an authorization request with no ${missing.join(", ")}`)
    }
    if (query.get("response_type") !== "code") {
      return refuses(`was given response_type=${query.get("response_type") ?? "(none)"}, and this fake serves the authorization-code flow alone`)
    }
    if (query.get("code_challenge_method") !== "S256") {
      return refuses("was given a request whose code_challenge_method is not S256, and the code this fake sends to a loopback redirect is only worthless to whoever reads it while the challenge is a hash")
    }
    if (query.get("access_type") !== "offline") {
      return refuses(`was given access_type=${query.get("access_type") ?? "(none)"}, and only access_type=offline is answered with a refresh token — the one credential this serve still has when the browser is gone`)
    }
    if (query.get("prompt") !== "consent") {
      return refuses(`was given prompt=${query.get("prompt") ?? "(none)"}, and only prompt=consent earns a refresh token on a RECONNECT rather than a silent reuse of the last grant`)
    }
    const redirect = query.get("redirect_uri") ?? ""
    const state = query.get("state") ?? ""
    const code = serial("olai-fake-code-")
    granted.set(code, {
      challenge: query.get("code_challenge") ?? "",
      client: query.get("client_id") ?? "",
      redirect,
      scope: query.get("scope") ?? "",
      spent: false,
    })
    const carried = new URLSearchParams({ code, state })
    return new Response(null, {
      status: 302,
      headers: { location: `${redirect}${redirect.includes("?") ? "&" : "?"}${carried.toString()}` },
    })
  }

  const tokens = (form: URLSearchParams): Response => {
    const grant = form.get("grant_type")
    if (grant === "authorization_code") {
      const code = form.get("code") ?? ""
      const held = granted.get(code)
      if (held === undefined) return invalidGrant("the authorization code is not one this fake minted")
      if (held.spent) return invalidGrant(`the authorization code ${code} has already been spent`)
      const verifier = form.get("code_verifier") ?? ""
      if (verifier === "") {
        return invalidGrant("no code_verifier was sent, and this fake authorized a challenge it can only check against one")
      }
      if (challengeOf(verifier) !== held.challenge) {
        return invalidGrant("the code_verifier does not hash to the code_challenge the authorization carried")
      }
      if ((form.get("client_id") ?? "") !== held.client) {
        return invalidGrant("client_id is not the one that authorized this code")
      }
      if ((form.get("redirect_uri") ?? "") !== held.redirect) {
        return invalidGrant("redirect_uri is not the one that authorized this code")
      }
      held.spent = true
      const access = fixture.accessToken ?? serial("ya29.olai-fake-")
      issued.push(access)
      return Response.json({
        access_token: access,
        refresh_token: serial("1//olai-fake-"),
        expires_in: fixture.expiresIn ?? 3600,
        scope: fixture.scope ?? held.scope,
        token_type: "Bearer",
      })
    }
    if (grant === "refresh_token") {
      if (fixture.refresh === "invalid_grant") {
        return invalidGrant('the refresh token is expired or revoked — this fixture says so (`refresh: "invalid_grant"`)')
      }
      if ((form.get("refresh_token") ?? "") === "") {
        return invalidGrant("no refresh_token was sent")
      }
      const access = fixture.accessToken ?? serial("ya29.olai-fake-")
      issued.push(access)
      // NO `refresh_token` in this answer, which is Google's shape when it is
      // not rotating one: `../../oauth.ts` reads its absence as *keep the one
      // you have*, and this is the arm that keeps that reading honest.
      return Response.json({
        access_token: access,
        expires_in: fixture.expiresIn ?? 3600,
        scope: fixture.scope ?? null,
        token_type: "Bearer",
      })
    }
    return Response.json(
      { error: "unsupported_grant_type", error_description: `fake-google: grant_type=${grant ?? "(none)"} is not one this fake serves` },
      { status: 400 },
    )
  }

  const revoke = (form: URLSearchParams): Response => {
    const token = form.get("token") ?? ""
    if (token === "") {
      return Response.json(
        { error: "invalid_request", error_description: "fake-google: /revoke was handed no token" },
        { status: 400 },
      )
    }
    revoked.push(token)
    return new Response("", { status: 200 })
  }

  const wrongMethod = (expected: string): Response =>
    Response.json(
      { error: "method_not_allowed", error_description: `fake-google: this endpoint answers ${expected} alone` },
      { status: 405 },
    )

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const body = request.method === "POST" ? await request.text() : ""
      requests.push({ method: request.method, path: url.pathname, query: url.search, body })
      const form = new URLSearchParams(body)
      if (url.pathname === AUTHORIZE_PATH) {
        return request.method === "GET" ? consent(url) : wrongMethod("GET")
      }
      if (url.pathname === TOKEN_PATH) {
        return request.method === "POST" ? tokens(form) : wrongMethod("POST")
      }
      if (url.pathname === REVOKE_PATH) {
        return request.method === "POST" ? revoke(form) : wrongMethod("POST")
      }
      return Response.json(
        {
          error: "not_found",
          error_description: `fake-google: ${url.pathname} is not one of the three endpoints this fake serves (${AUTHORIZE_PATH}, ${TOKEN_PATH}, ${REVOKE_PATH})`,
        },
        { status: 404 },
      )
    },
  })

  return {
    origin: `http://127.0.0.1:${server.port}`,
    rewrite,
    requests: () => requests,
    revoked: () => revoked,
    issued: () => issued,
    stop: async () => {
      await server.stop(true)
    },
  }
}
