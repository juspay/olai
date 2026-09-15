/**
 * A GOOGLE THAT IS NOT GOOGLE — the three endpoints the OAuth flow spends, on
 * one loopback origin, for the harness's `OLAI_MAIL_GOOGLE`.
 *
 * ## Why a real HTTP server, and why one origin
 *
 * `../../oauth.ts` composes every URL of this flow from an origin, and
 * `endpointsAt(origin)` is what a serve pointed at `OLAI_MAIL_GOOGLE` gets:
 * `/o/oauth2/v2/auth`, `/token`, `/revoke`. A fake therefore has to be a real
 * server on a real socket — a stubbed `fetch` would test the plugin against
 * this test's idea of HTTP rather than against HTTP — and one origin is enough
 * because that is all the variable moves. It listens on `127.0.0.1` on a port
 * the SERVER picks (`port: 0`), not one picked before it: this fake runs in the
 * caller's own process, so there is no child to tell a port to and no window in
 * which a pre-picked one can be taken by somebody else — the reason
 * `olai-plugin-odu`'s SPAWNED `fake-service.ts` has to find one first.
 *
 * ## What it refuses, which is the whole of its value
 *
 * The consent screen auto-consents — there is no browser in a scenario — but it
 * is not permissive about WHAT it consents to. `access_type=offline` and
 * `prompt=consent` TOGETHER are what make Google hand back a refresh token, and
 * `code_challenge_method=S256` is what makes the code Google sends to a
 * loopback redirect worthless to whoever reads it: those three are the
 * properties the plugin's authorization URL EXISTS for (`../../oauth.ts` argues
 * each of them at length). A fake that ignored them would let the regression
 * that dropped one pass as a green scenario, so a request without them is a
 * 400 with a sentence saying which one and why it matters.
 *
 * The token endpoint is the other half. `grant_type=authorization_code` checks
 * the code was this fake's, that it has not been spent, that the verifier
 * hashes to the challenge the authorization carried, and that `client_id` and
 * `redirect_uri` are the ones that authorized it — RFC 6749 §4.1.3 and RFC 7636
 * §4.6 in four lines each. The hash is computed HERE, with `node:crypto`,
 * rather than imported from `../../oauth.ts`: a fake that verified with the very
 * function the plugin computes the challenge with would agree with a wrong
 * `challengeOf` and pass the round trip written to catch exactly that.
 *
 * `grant_type=refresh_token` answers a fresh access token and — Google's own
 * shape when it is not rotating — no refresh token at all, which is the arm
 * `../../oauth.ts` reads as *keep the one you have*. `refresh:
 * "invalid_grant"` in the fixture is how a scenario drives the plugin's fault
 * arm without a broken token.
 *
 * ## What it records
 *
 * Every request verbatim (`method`, `path`, `query`, `body`), the access tokens
 * it minted (`issued()`), and the tokens handed to `/revoke` (`revoked()`) —
 * because the assertions worth making are about what the plugin SENT, and a
 * fake that only answers cannot make them.
 *
 * ## The fixture is LIVE
 *
 * {@link FakeGoogle.rewrite} replaces what the next request is answered with,
 * which is a scenario's only way to move an answer mid-flow: a serve is handed
 * this origin when it is SPAWNED, so a second fake is not something a step can
 * reach for, and the fault-and-recover path is exactly a serve whose next
 * refresh fails and whose next one after that succeeds. The records above and
 * the grants already given out are untouched by a rewrite — what moves is what
 * this fake SAYS.
 *
 * ## The one field that is not an endpoint
 *
 * `email` is the account this consent screen consents as. Nothing in the OAuth
 * response carries it (the address a screenshot shows comes from Gmail, and in
 * a scenario that is the Himalaya fake's `profile`), so it is named in the
 * prose of every refusal of an AUTHORIZATION request here: a scenario whose two
 * fakes disagree about whose mailbox this is can then read the address it was
 * consenting as off a failure instead of guessing.
 */

import { createHash } from "node:crypto"

/** The three paths, spelled as `../../oauth.ts`'s `endpointsAt` composes them. */
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

/** A fixture, as a scenario writes it: the account, the arm the refresh takes,
 *  and the three values the token answer is made of. */
export interface FakeGoogleInput {
  /** The account this consent screen consents as. Required, and named in every
   *  refusal — a fake that did not know whose mailbox it was authorizing could
   *  not say which account a scenario's two fakes had been pointed at. */
  readonly email: string
  /** `"invalid_grant"` makes every refresh fail the way Google fails one whose
   *  grant is revoked. `"ok"` is the default. */
  readonly refresh?: "ok" | "invalid_grant"
  /** The access token to answer with, when a scenario needs it to be a KNOWN
   *  string. Absent, each answer mints a fresh one (`issued()` holds them). */
  readonly accessToken?: string
  /** Seconds, in the token answer. Default 3600, which is what Google sends. */
  readonly expiresIn?: number
  /** The `scope` in the token answer. Absent, the code exchange reports the
   *  scope the authorization asked for (this fake consents to all of it) and a
   *  refresh reports `null`. */
  readonly scope?: string
}

/** One request this fake was handed, kept verbatim. */
export interface GoogleRequest {
  readonly method: string
  readonly path: string
  /** The query string as it arrived, `?` included — for the authorization
   *  request this is the whole of what the plugin sent, and
   *  `new URLSearchParams(query)` reads it back. */
  readonly query: string
  /** The body as it arrived: form-encoded for the two POSTs, `""` for a GET. */
  readonly body: string
}

/** The fake, as the harness holds it. */
export interface FakeGoogle {
  /** `http://127.0.0.1:<port>` — what goes in `OLAI_MAIL_GOOGLE`, and the
   *  origin `endpointsAt` turns into the three URLs the plugin will call. */
  readonly origin: string
  /** What the next request is answered with — the whole fixture again, as
   *  {@link FakeGoogleInput} (a fixture with no `email` is refused here, at the
   *  step that wrote it, rather than at the next request). Synchronous, and the
   *  arm a scenario's fault-and-recover path needs: `refresh: "invalid_grant"`
   *  makes a serve's next refresh fail and rewriting it back makes the next one
   *  succeed, ON THE SAME FAKE, because the origin a spawned serve was handed
   *  cannot be moved. The request log, the tokens already issued and the codes
   *  already given out are NOT touched: what moves is what this fake SAYS. */
  readonly rewrite: (next: FakeGoogleInput) => void
  /** Every request so far, in order. */
  readonly requests: () => ReadonlyArray<GoogleRequest>
  /** Every token handed to `/revoke`, in order. */
  readonly revoked: () => ReadonlyArray<string>
  /** Every access token minted, in order. */
  readonly issued: () => ReadonlyArray<string>
  readonly stop: () => Promise<void>
}

/** One consent this fake gave: the code, and the properties that code is only
 *  redeemable WITH. A grant is spent by the exchange that verifies against it,
 *  which is what makes a replayed code a 400 — an authorization code is
 *  single-use, and a fake that let one ride twice would hide a double-exchange
 *  bug in the plugin. */
interface Grant {
  readonly challenge: string
  readonly client: string
  readonly redirect: string
  readonly scope: string
  spent: boolean
}

/**
 * THE FAKE, LISTENING — one origin, three endpoints, every request recorded.
 */
export const startFakeGoogle = async (input: FakeGoogleInput): Promise<FakeGoogle> => {
  // The fixture is MUTABLE: a scenario moves the answers of a flow that is
  // already running, and it cannot start a second fake to do it — the serve was
  // spawned with this origin. `input` seeds it through `rewrite`, so the one
  // guard below runs on both paths.
  let fixture = input
  /** What the NEXT request is answered with. The request log, the tokens
   *  already issued, the tokens already revoked and the authorization codes
   *  already given out all stay where they are: what moves is what this fake
   *  SAYS, which is the whole of what `refresh: "invalid_grant"` is for. */
  const rewrite = (next: FakeGoogleInput): void => {
    if (next.email.trim() === "") {
      throw new Error("fake-google: a fixture with no email has no account to consent as")
    }
    fixture = next
  }
  rewrite(input)
  /** Serials rather than entropy: a failure that names `olai-fake-code-3` is a
   *  failure a reader can follow through the request log, and nothing about
   *  this fake is more secure for being unguessable. */
  let minted = 0
  const serial = (prefix: string): string => {
    minted += 1
    return `${prefix}${minted}`
  }
  const granted = new Map<string, Grant>()
  const requests: Array<GoogleRequest> = []
  const revoked: Array<string> = []
  const issued: Array<string> = []

  /** A refusal of the authorization request: the sentence names the account
   *  being consented as, then what was wrong with the asking. */
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

  /** The consent screen, consenting: the code is minted, the properties it is
   *  bound to are remembered, and the browser is sent back to `redirect_uri`
   *  with the code and the SAME `state`. */
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

  /** The token endpoint, on both grants. */
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

  /** The revocation. Google answers 200 with an empty body and no other arm;
   *  a missing token is the one thing it does refuse. */
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
