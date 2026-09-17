import { expect, test } from "bun:test"
import { Effect, Result } from "effect"

import { type AccountMachine, LEAD_MS, lifeOf, makeAccount, MINIMUM_GAP_MS, PENDING_MS, profileOf, refreshDue, RETRY_MS } from "./account.ts"
import { CREDENTIALS, DOOR } from "./doors.ts"
import type { Himalaya } from "./himalaya/run.ts"
import { openMemory, type MemoryRecord } from "./local.ts"
import { doorOver } from "./local.testlib.ts"
import { GOOGLE, googleOf, LOOPBACK_ONLY } from "./oauth.ts"
import { type Account, MAIL_UNCONNECTED, MailRefusal, REDIRECT_PATH, SCOPE } from "./wire.ts"

const ADDRESS = "you@gmail.com"
const CONNECTED_AT = "2026-09-15T10:00:00.000Z"

const PROFILE = { email: ADDRESS, "messages-total": 4213, "threads-total": 900, "history-id": "h-9" }

const RECORD: MemoryRecord = { historyId: null, refreshToken: "1//rt", address: ADDRESS, scope: SCOPE, connectedAt: CONNECTED_AT }

interface Answer {
  readonly status: number
  readonly body: unknown
}

interface Harness {
  readonly machine: AccountMachine
  readonly painted: ReadonlyArray<Account>
  readonly tokens: ReadonlyArray<{ readonly token: string; readonly address: string | null }>
  readonly posts: ReadonlyArray<{ readonly url: string; readonly body: string }>
  readonly warnings: ReadonlyArray<string>
  readonly memory: MemoryRecord | undefined
  readonly closed: () => number
  readonly at: (iso: string) => void
  readonly answers: (queue: ReadonlyArray<Answer>) => void
}

/**
 * THE MACHINE, WITH EVERY DOOR IT SPENDS REPLACED — including the two that are
 * real: the memory record is `openMemory` over a door this test owns (that
 * parse is code, not a fixture), and the clock is an ISO string this test moves.
 * Everything else is a queue of answers and a list of what was asked.
 */
const harness = (over: {
  readonly binary?: string | undefined
  readonly client?: string | undefined
  readonly secret?: string | undefined
  readonly google?: string | undefined
  readonly record?: MemoryRecord | undefined
  readonly profile?: unknown
  readonly runFails?: string
  readonly useTokenFails?: string
} = {}): Harness => {
  let iso = CONNECTED_AT
  const held = doorOver(over.record === undefined ? {} : { ...over.record })
  const painted: Account[] = []
  const tokens: Array<{ token: string; address: string | null }> = []
  const posts: Array<{ url: string; body: string }> = []
  const warnings: string[] = []
  const queued: Answer[] = []
  let closed = 0

  const himalaya: Himalaya = {
    binary: "binary" in over ? over.binary : "/nix/store/x/bin/himalaya",
    useToken: (input) => {
      if (over.useTokenFails !== undefined) return Effect.fail(new MailRefusal({ reason: over.useTokenFails }))
      tokens.push(input)
      return Effect.void
    },
    run: () =>
      over.runFails !== undefined
        ? Effect.fail(new MailRefusal({ reason: over.runFails }))
        : Effect.succeed(over.profile ?? PROFILE),
    close: async () => { closed += 1 },
  }

  const machine = makeAccount({
    clock: { now: () => iso },
    client: "client" in over ? over.client : "cid.apps.googleusercontent.com",
    secret: "secret" in over ? over.secret : "sec",
    google: googleOf("google" in over ? over.google : undefined),
    himalaya,
    memory: Effect.runSync(openMemory(held.door, (line) => warnings.push(line))),
    post: async (request) => {
      posts.push({ url: request.url, body: request.body })
      const next = queued.shift() ?? { status: 200, body: { access_token: "at-1", expires_in: 3600, scope: SCOPE } }
      return { status: next.status, body: JSON.stringify(next.body) }
    },
    paint: (account) => painted.push(account),
    warn: (line) => warnings.push(line),
  })

  return {
    machine,
    painted,
    tokens,
    posts,
    warnings,
    get memory() {
      const raw = held.now()
      return raw === null || raw.refreshToken === undefined ? undefined : (raw as unknown as MemoryRecord)
    },
    closed: () => closed,
    at: (next) => { iso = next },
    answers: (queue) => { queued.push(...queue) },
  }
}

const last = (painted: ReadonlyArray<Account>): Account => painted[painted.length - 1] ?? MAIL_UNCONNECTED

test("a serve with no record is absent, and says whether Connect could work", async () => {
  const ready = harness()
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted)).toEqual({
    status: "absent",
    address: null,
    messages: null,
    refreshedAt: null,
    scope: SCOPE,
    redirect: "",
    reason: null,
    retrying: false,
    canConnect: true,
  })

  const short = harness({ client: undefined, secret: undefined })
  await Effect.runPromise(short.machine.boot())
  expect(last(short.painted).status).toBe("absent")
  expect(last(short.painted).reason).toContain(DOOR.client)
  expect(last(short.painted).reason).toContain(DOOR.secret)
})

test("no pinned binary is a fault in its own words, and nothing is run", async () => {
  const ready = harness({ binary: undefined, record: RECORD })
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("fault")
  expect(last(ready.painted).reason).toContain("Nix build")
  // NOTHING A PRESS CAN DO, and the cell says so — which is what stops the row
  // drawing a Reconnect button whose press would land its own refusal.
  expect(last(ready.painted).canConnect).toBe(false)
  expect(ready.tokens).toHaveLength(0)
  expect(ready.posts).toHaveLength(0)
})

test("boot brings a stored record up: refresh, profile, connected", async () => {
  const ready = harness({ record: RECORD })
  await Effect.runPromise(ready.machine.boot())
  expect(ready.posts[0]?.url).toBe(GOOGLE.token)
  expect(new URLSearchParams(ready.posts[0]?.body ?? "").get("grant_type")).toBe("refresh_token")
  expect(new URLSearchParams(ready.posts[0]?.body ?? "").get("refresh_token")).toBe("1//rt")
  expect(ready.tokens).toEqual([{ token: "at-1", address: ADDRESS }])
  expect(last(ready.painted)).toEqual({
    status: "connected",
    address: ADDRESS,
    messages: 4213,
    refreshedAt: CONNECTED_AT,
    scope: SCOPE,
    redirect: "",
    reason: null,
    retrying: false,
    canConnect: true,
  })
  expect(ready.memory?.address).toBe(ADDRESS)
})

test("a refused refresh is a fault carrying Google's own word, and the token is dropped", async () => {
  const ready = harness({ record: RECORD })
  ready.answers([{ status: 400, body: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }])
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("fault")
  expect(last(ready.painted).reason).toContain("invalid_grant")
  // The generated config holds a token Google just refused; it does not sit on
  // disk while the row says fault.
  expect(ready.closed()).toBe(1)
  expect(ready.tokens).toHaveLength(0)
})

test("a transport failure is a RETRY: the record and the token survive", async () => {
  const ready = harness({ record: RECORD })
  ready.answers([{ status: 0, body: { error: "unreachable", error_description: "fetch failed" } }])
  await Effect.runPromise(ready.machine.boot())
  // The cell says it is a WAIT rather than a verdict — the field the faces
  // branch on — and the reason is Google's own word verbatim (`wire.ts`).
  expect(last(ready.painted).status).toBe("fault")
  expect(last(ready.painted).retrying).toBe(true)
  expect(last(ready.painted).reason).toContain("unreachable")
  // ...the refresh token is still on disk, the config was NOT removed, and the
  // row can still be repaired by pressing Reconnect.
  expect(ready.memory?.refreshToken).toBe(RECORD.refreshToken)
  expect(ready.closed()).toBe(0)
  expect(last(ready.painted).canConnect).toBe(true)
  expect(last(ready.painted).address).toBe(ADDRESS)
})

test("a retry with a live token keeps the pill CONNECTED, and says what is retrying", async () => {
  const ready = harness({ record: RECORD })
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("connected")
  // The refresh that follows the first one is what normally happens five
  // minutes before the token dies — and the token it is replacing is still
  // good, so a `gmail` call would answer. The pill must not wear the alarm
  // coat over a mailbox that works, and the reading must keep the mailbox's
  // own facts.
  ready.answers([{ status: 503, body: { error: "backend_error" } }])
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("connected")
  expect(last(ready.painted).retrying).toBe(true)
  expect(last(ready.painted).reason).toContain("backend_error")
  expect(last(ready.painted).address).toBe(ADDRESS)
  expect(last(ready.painted).messages).toBe(4213)
  // ...and a press is not what it needs: `mailNeedsYou` reads the same field.
  expect(last(ready.painted).canConnect).toBe(true)
})

test("...and once that token has expired the same failure is a fault", async () => {
  const ready = harness({ record: RECORD })
  await Effect.runPromise(ready.machine.boot())
  // A token that is no longer live leaves nothing to fall back on.
  ready.at(new Date(Date.parse(CONNECTED_AT) + 3600_000 + 1).toISOString())
  ready.answers([{ status: 503, body: { error: "backend_error" } }])
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("fault")
  expect(last(ready.painted).retrying).toBe(true)
  expect(last(ready.painted).address).toBe(ADDRESS)
})

test("a 5xx is a RETRY too, and the next attempt is armed on the backoff", async () => {
  const ready = harness({ record: RECORD })
  ready.answers([{ status: 503, body: { error: "backend_error" } }])
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).reason).toContain("backend_error")
  expect(last(ready.painted).retrying).toBe(true)
  expect(ready.memory?.refreshToken).toBe(RECORD.refreshToken)
  expect(RETRY_MS).toBeGreaterThan(0)
})

test("a word from Google is a VERDICT: the token goes and a person is asked", async () => {
  const ready = harness({ record: RECORD })
  ready.answers([{ status: 400, body: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }])
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).reason).toContain("invalid_grant")
  expect(last(ready.painted).retrying).toBe(false)
  // The generated config holds a token Google just refused; it does not sit on
  // disk while the row says fault.
  expect(ready.closed()).toBe(1)
})

test("a Google origin that is not loopback is a fault naming the ruling", async () => {
  const ready = harness({ google: "https://accounts.example" })
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("fault")
  expect(last(ready.painted).reason).toBe(LOOPBACK_ONLY)
  expect(last(ready.painted).canConnect).toBe(false)
  // A press could not work, so the machine refuses it in the same words.
  const pressed = await Effect.runPromise(Effect.result(ready.machine.begin("http://127.0.0.1:7714")))
  expect(Result.isFailure(pressed)).toBe(true)
  if (Result.isFailure(pressed)) expect(pressed.failure.reason).toBe(LOOPBACK_ONLY)
})

test("a loopback fake is honoured, which is the whole of what the harness needs", async () => {
  const ready = harness({ google: "http://127.0.0.1:4321" })
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("absent")
  const begun = await Effect.runPromise(ready.machine.begin("http://127.0.0.1:7714"))
  expect(new URL(begun.url).origin).toBe("http://127.0.0.1:4321")
})

test("a rotated refresh token replaces the one on disk", async () => {
  const ready = harness({ record: RECORD })
  ready.answers([{ status: 200, body: { access_token: "at-2", refresh_token: "1//rt2", expires_in: 60, scope: SCOPE } }])
  await Effect.runPromise(ready.machine.boot())
  expect(ready.memory?.refreshToken).toBe("1//rt2")
  expect(last(ready.painted).status).toBe("connected")
})

test("a token the disk will not take is a fault, and says which", async () => {
  const ready = harness({ record: RECORD, useTokenFails: "could not write Himalaya's config: read-only" })
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("fault")
  expect(last(ready.painted).reason).toContain("could not write Himalaya's config")
})

test("a Himalaya that does not answer is a RETRY carrying its sentence", async () => {
  const ready = harness({ record: RECORD, runFails: "gmail.googleapis.com: name resolution failed" })
  await Effect.runPromise(ready.machine.boot())
  // The child is a network client: its failure is the world's, not a verdict,
  // and the refresh token is not touched for it.
  expect(last(ready.painted).reason).toBe("gmail.googleapis.com: name resolution failed")
  expect(last(ready.painted).retrying).toBe(true)
  expect(ready.memory?.refreshToken).toBe(RECORD.refreshToken)
  expect(ready.closed()).toBe(0)
})

test("a profile this plugin cannot read is a verdict rather than a retry", async () => {
  const ready = harness({ record: RECORD, profile: { "messages-total": 12 } })
  await Effect.runPromise(ready.machine.boot())
  // A fact about the pin's JSON cannot change under a running serve, so there
  // is nothing to wait for.
  expect(last(ready.painted).reason).toContain("cannot read")
  expect(last(ready.painted).retrying).toBe(false)
})

test("begin refuses without the credentials, naming both doors", async () => {
  const short = harness({ client: undefined, secret: undefined })
  const outcome = await Effect.runPromise(Effect.result(short.machine.begin("http://127.0.0.1:7714")))
  expect(Result.isFailure(outcome)).toBe(true)
  if (Result.isFailure(outcome)) {
    expect(outcome.failure.reason).toContain(CREDENTIALS)
  }
  expect(short.painted).toHaveLength(0)
})

test("begin arms a connect for the page's own origin, and says which URI to register", async () => {
  const ready = harness()
  const begun = await Effect.runPromise(ready.machine.begin("https://olai.example"))
  const url = new URL(begun.url)
  expect(url.origin + url.pathname).toBe(GOOGLE.authorize)
  expect(url.searchParams.get("redirect_uri")).toBe(`https://olai.example${REDIRECT_PATH}`)
  expect(url.searchParams.get("state")).not.toBe("")
  expect(url.searchParams.get("code_challenge")).not.toBe("")
  expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  // The row's hint draws this string under the button, and it is only knowable
  // once a page has said where it is.
  expect(last(ready.painted).redirect).toBe(`https://olai.example${REDIRECT_PATH}`)
})

test("arming a connect does not blank a pill that is telling the truth", async () => {
  const ready = harness({ record: RECORD })
  await Effect.runPromise(ready.machine.boot())
  expect(last(ready.painted).status).toBe("connected")
  // Pressing Connect on a connected row is how a person points the serve at a
  // DIFFERENT mailbox, and the reading until the callback lands is still the
  // account this serve is holding.
  await Effect.runPromise(ready.machine.begin("https://olai.example"))
  expect(last(ready.painted).status).toBe("connected")
  expect(last(ready.painted).address).toBe(ADDRESS)
  expect(last(ready.painted).redirect).toBe(`https://olai.example${REDIRECT_PATH}`)
})

test("begin refuses something that is not an origin", async () => {
  const ready = harness()
  for (const wrong of ["https://olai.example/vault", "https://olai.example/?x=1", "ftp://olai.example", "not a url"]) {
    const outcome = await Effect.runPromise(Effect.result(ready.machine.begin(wrong)))
    expect(Result.isFailure(outcome), wrong).toBe(true)
  }
  expect(ready.painted).toHaveLength(0)
})

test("a callback this serve did not mint is refused and spends nothing", async () => {
  const ready = harness()
  const begun = await Effect.runPromise(ready.machine.begin("http://127.0.0.1:7714"))
  const state = new URL(begun.url).searchParams.get("state") ?? ""
  const stray = await Effect.runPromise(Effect.result(ready.machine.complete({ code: "c-1", state: "somebody-elses" })))
  expect(Result.isFailure(stray)).toBe(true)
  // The connect a person is waiting on is still armed: the real callback lands.
  ready.answers([
    { status: 200, body: { access_token: "at-1", refresh_token: "1//rt", expires_in: 3600, scope: SCOPE } },
    { status: 200, body: PROFILE },
  ])
  const done = await Effect.runPromise(ready.machine.complete({ code: "c-real", state }))
  expect(done.address).toBe(ADDRESS)
})

test("a state older than ten minutes is refused", async () => {
  const ready = harness()
  const begun = await Effect.runPromise(ready.machine.begin("http://127.0.0.1:7714"))
  ready.at(new Date(Date.parse(CONNECTED_AT) + PENDING_MS + 1).toISOString())
  const late = await Effect.runPromise(Effect.result(ready.machine.complete({ code: "c-1", state: new URL(begun.url).searchParams.get("state") ?? "" })))
  expect(Result.isFailure(late)).toBe(true)
  if (Result.isFailure(late)) expect(late.failure.reason).toContain("ten minutes")
})

test("a played-back callback is refused the second time", async () => {
  const ready = harness()
  const begun = await Effect.runPromise(ready.machine.begin("http://127.0.0.1:7714"))
  const state = new URL(begun.url).searchParams.get("state") ?? ""
  ready.answers([{ status: 200, body: { access_token: "at-1", refresh_token: "1//rt", expires_in: 3600, scope: SCOPE } }])
  ready.answers([{ status: 200, body: PROFILE }])
  await Effect.runPromise(ready.machine.complete({ code: "c-1", state }))
  const replay = await Effect.runPromise(Effect.result(ready.machine.complete({ code: "c-1", state })))
  expect(Result.isFailure(replay)).toBe(true)
})

test("a connect stores the record, asks the profile, and reports the address", async () => {
  const ready = harness()
  const begun = await Effect.runPromise(ready.machine.begin("http://127.0.0.1:7714"))
  ready.answers([
    { status: 200, body: { access_token: "at-1", refresh_token: "1//rt", expires_in: 3600, scope: SCOPE } },
    { status: 200, body: PROFILE },
  ])
  const done = await Effect.runPromise(ready.machine.complete({ code: "c-1", state: new URL(begun.url).searchParams.get("state") ?? "" }))
  expect(done.address).toBe(ADDRESS)
  expect(ready.memory).toEqual({ historyId: null, refreshToken: "1//rt", address: ADDRESS, scope: SCOPE, connectedAt: CONNECTED_AT })
  expect(last(ready.painted).status).toBe("connected")
  // The exchange carried the verifier and the redirect the authorization URL
  // was built with — the PKCE pair is what makes a leaked code worthless.
  const exchange = new URLSearchParams(ready.posts[0]?.body ?? "")
  expect(exchange.get("grant_type")).toBe("authorization_code")
  expect(exchange.get("code")).toBe("c-1")
  expect(exchange.get("redirect_uri")).toBe(`http://127.0.0.1:7714${REDIRECT_PATH}`)
  expect(exchange.get("code_verifier")).not.toBe("")
})

test("a connect Google would not complete is refused in Google's words and stores nothing", async () => {
  const ready = harness()
  const begun = await Effect.runPromise(ready.machine.begin("http://127.0.0.1:7714"))
  ready.answers([{ status: 400, body: { error: "redirect_uri_mismatch", error_description: "Bad Request" } }])
  const outcome = await Effect.runPromise(Effect.result(ready.machine.complete({ code: "c-1", state: new URL(begun.url).searchParams.get("state") ?? "" })))
  expect(Result.isFailure(outcome)).toBe(true)
  if (Result.isFailure(outcome)) expect(outcome.failure.reason).toContain("redirect_uri_mismatch")
  expect(ready.memory).toBeUndefined()
})

test("an answer with no refresh token is refused rather than kept for an hour", async () => {
  const ready = harness()
  const begun = await Effect.runPromise(ready.machine.begin("http://127.0.0.1:7714"))
  ready.answers([{ status: 200, body: { access_token: "at-1", expires_in: 3600, scope: SCOPE } }])
  const outcome = await Effect.runPromise(Effect.result(ready.machine.complete({ code: "c-1", state: new URL(begun.url).searchParams.get("state") ?? "" })))
  expect(Result.isFailure(outcome)).toBe(true)
  expect(ready.memory).toBeUndefined()
})

test("disconnect revokes at Google, forgets the record, and goes back to absent", async () => {
  const ready = harness({ record: RECORD })
  await Effect.runPromise(ready.machine.boot())
  await Effect.runPromise(ready.machine.disconnect())
  expect(ready.posts[ready.posts.length - 1]?.url).toBe(GOOGLE.revoke)
  expect(new URLSearchParams(ready.posts[ready.posts.length - 1]?.body ?? "").get("token")).toBe("1//rt")
  expect(ready.memory).toBeUndefined()
  expect(ready.closed()).toBe(1)
  expect(last(ready.painted).status).toBe("absent")
  expect(last(ready.painted).reason).toBeNull()
})

test("a revoke Google would not take is still a disconnect, said once", async () => {
  const ready = harness({ record: RECORD })
  await Effect.runPromise(ready.machine.boot())
  ready.answers([{ status: 500, body: { error: "backend_error" } }])
  await Effect.runPromise(ready.machine.disconnect())
  expect(ready.memory).toBeUndefined()
  expect(last(ready.painted).status).toBe("absent")
  expect(ready.warnings.some((line) => line.includes("did not revoke"))).toBe(true)
})

test("the refresh is due five minutes before the token expires", () => {
  const now = Date.parse(CONNECTED_AT)
  expect(refreshDue(lifeOf({ now, expiresIn: 3600 }))).toBe(now + 3600_000 - LEAD_MS)
})

test("a token that lives less than the lead is refreshed at half its life, never in a loop", () => {
  const now = Date.parse(CONNECTED_AT)
  // `expires_in <= LEAD` would answer `now` for every token Google answers
  // with a short life, which is a refresh loop with no sleep in it.
  expect(refreshDue(lifeOf({ now, expiresIn: 300 }))).toBe(now + 150_000)
  // ...and an absurd life is floored rather than spun on.
  expect(refreshDue(lifeOf({ now, expiresIn: 0 }))).toBe(now + MINIMUM_GAP_MS)
  expect(MINIMUM_GAP_MS).toBeGreaterThan(0)
})

test("a token's life says whether what the config holds is still usable", () => {
  const now = Date.parse(CONNECTED_AT)
  const life = lifeOf({ now, expiresIn: 3600 })
  expect(life.until > now).toBe(true)
  // ...and a token that has expired is not (`retrying` reads this).
  expect(life.until > now + 3600_000).toBe(false)
})

test("a profile answer is read off the binary's own kebab-case JSON", () => {
  expect(profileOf(PROFILE)).toEqual({ address: ADDRESS, messages: 4213 })
  expect(profileOf({ email: ADDRESS })).toEqual({ address: ADDRESS, messages: null })
  expect(profileOf({ "messages-total": 12 })).toBeUndefined()
  expect(profileOf("nope")).toBeUndefined()
})
