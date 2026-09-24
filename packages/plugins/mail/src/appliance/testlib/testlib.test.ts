/**
 * THE TWO FAKES, DRIVEN DIRECTLY — what the harness will do to them, without a
 * serve, a browser or a scenario.
 *
 * A fake that answers is not evidence; a fake that refuses is. So these tests
 * are mostly about the refusals: an unoffered verb is clap's `unrecognized
 * subcommand` and exit 2, an invocation with no `--json` is refused rather than
 * answered in a shape the plugin cannot read, a config that is not a file stops
 * a verb before it is answered, and on Google's side a request that would not
 * earn a refresh token — or a code redeemed with the wrong verifier — is a 400.
 * The happy paths are here too, and each one is asserted through the PLUGIN'S
 * OWN shapes: the argv `himalayaArgv` composes, the authorization URL
 * `authorizationUrl` composes, the form bodies `exchangeRequest`,
 * `refreshRequest` and `revokeRequest` compose. A fake that only agreed with a
 * test's private idea of those would prove nothing about the plugin.
 */

import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "bun:test"

import { renderConfig } from "../../himalaya/config.ts"
import { GMAIL, himalayaArgv } from "../../himalaya/verbs.ts"
import {
  authorizationUrl,
  challengeOf,
  endpointsAt,
  exchangeRequest,
  FORM_CONTENT_TYPE,
  newState,
  refreshRequest,
  revokeRequest,
  tokenAnswer,
  verifierOf,
} from "../../oauth.ts"
import type { FakeGoogle } from "./fake-google.ts"
import { startFakeGoogleFor } from "./fake-google.ts"
import type { FakeHimalaya, MailFixture } from "./fake-himalaya.ts"
import { draftContents, PINNED_VERSION, startFakeHimalayaFor } from "./fake-himalaya.ts"

/** The OAuth client a scenario configures a serve with. Nothing checks it: the
 *  fake's job is that the SAME two strings come back on the exchange, which is
 *  the property a copy-paste error in the plugin would break. */
const CLIENT = "olai-test-client"
const SECRET = "olai-test-secret"
/** A loopback redirect on a port nothing listens on: these tests read the 302
 *  rather than chase it, so a real listener would be a listener to leak. */
const REDIRECT = "http://127.0.0.1:9/_olai/mail/oauth"
const EMAIL = "reader@olai.invalid"

interface Done {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

/**
 * ONE SPAWN OF THE FAKE BINARY, at the boundary the plugin spawns at: the path
 * IS the program, `shell: false`, both streams read as text, and the exit code
 * taken from the close.
 *
 * DELIBERATELY NOT `makeHimalaya`, though that is the plugin's own way of
 * running a binary (`../../himalaya/run.ts`). What is under test here is the
 * FAKE — that it answers the argv the plugin composes, that its refusals come
 * back in clap's shape, that `--version` leads with the line the surface check
 * parses — and the runner's own API answers *parsed JSON or a refusal
 * sentence*, which is exactly the raw material these assertions are made of.
 * Driving the fake through the runner would delete the subject to reuse a
 * helper, so the spawn is spelled here and its shape is the assertion.
 */
const run = (fake: FakeHimalaya, argv: ReadonlyArray<string>): Promise<Done> => {
  const { promise, resolve } = Promise.withResolvers<Done>()
  const child = spawn(fake.path, [...argv], { shell: false, stdio: ["ignore", "pipe", "pipe"] })
  let stdout = ""
  let stderr = ""
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => { stdout += chunk })
  child.stderr?.on("data", (chunk: string) => { stderr += chunk })
  child.on("close", (code) => resolve({ code, stdout, stderr }))
  return promise
}

/** THE FAKE AND THE CONFIG TO POINT IT AT. The config is the plugin's own
 *  `renderConfig`, because the file has to EXIST — the fake refuses a verb
 *  against a config that is not there — and it is written into the fake's own
 *  temp directory so that one `stop()` is the only cleanup a test needs. */
const startedFake = async (fixture: MailFixture): Promise<{ readonly fake: FakeHimalaya; readonly config: string }> => {
  const fake = await startFakeHimalayaFor(fixture)
  const config = path.join(path.dirname(fake.fixturePath), "config.toml")
  writeFileSync(config, renderConfig({ token: "ya29.olai-fake", address: fixture.profile?.email ?? null }))
  return { fake, config }
}

/** One consent, as the plugin asks for it: the URL `../../oauth.ts` composes for
 *  a given verifier, followed with `redirect: "manual"` so the 302 is READ and
 *  the code taken out of it rather than chased into a dead port. */
const consented = async (google: FakeGoogle, verifier: string, state: string): Promise<URL> => {
  const endpoints = endpointsAt(google.origin)
  const asked = authorizationUrl(endpoints, { client: CLIENT, redirect: REDIRECT, state, challenge: challengeOf(verifier) })
  const response = await fetch(asked, { redirect: "manual" })
  expect(response.status).toBe(302)
  return new URL(response.headers.get("location") ?? "")
}

/** The exchange, as the plugin sends it. */
const exchanged = async (google: FakeGoogle, code: string, verifier: string): Promise<Response> => {
  const request = exchangeRequest(endpointsAt(google.origin), { client: CLIENT, secret: SECRET, code, redirect: REDIRECT, verifier })
  return fetch(request.url, { method: "POST", headers: { "content-type": FORM_CONTENT_TYPE }, body: request.body })
}

/** A verifier of the length RFC 7636 §4.1 allows, from bytes the test chose. */
const verifier = (seed: number): string => verifierOf(new Uint8Array(32).fill(seed))

test("--version prints the pin's line and the two under it", async () => {
  const { fake } = await startedFake({ profile: { email: EMAIL } })
  try {
    for (const flag of ["--version", "-V"]) {
      const done = await run(fake, [flag])
      expect(done.code, flag).toBe(0)
      expect(done.stderr, flag).toBe("")
      const lines = done.stdout.trimEnd().split("\n")
      expect(lines[0], flag).toBe(PINNED_VERSION)
      expect(lines[1]?.startsWith("build: "), flag).toBe(true)
      expect(lines[2]?.startsWith("git: "), flag).toBe(true)
    }
    // ...and the fixture's `version` replaces the FIRST line only, which is how
    // a scenario makes a serve read a pin that slid back.
    fake.rewrite({ version: "himalaya v2.0.0 +gmail" })
    const older = await run(fake, ["--version"])
    expect(older.stdout.trimEnd().split("\n")[0]).toBe("himalaya v2.0.0 +gmail")
    expect(older.stdout).toContain("build: ")
  } finally {
    await fake.stop()
  }
})

test("gmail profile get answers the fixture's mailbox in the pin's own JSON", async () => {
  const { fake, config } = await startedFake({
    profile: { email: EMAIL, messagesTotal: 4211, threadsTotal: 1900, historyId: "h-99" },
  })
  try {
    const done = await run(fake, [...himalayaArgv(config, GMAIL.profileGet.path, [])])
    expect(done.code).toBe(0)
    expect(done.stderr).toBe("")
    expect(JSON.parse(done.stdout)).toEqual({
      email: EMAIL,
      "messages-total": 4211,
      "threads-total": 1900,
      "history-id": "h-99",
    })
  } finally {
    await fake.stop()
  }
})

test("the totals are OMITTED when the fixture does not carry them", async () => {
  const { fake, config } = await startedFake({ profile: { email: EMAIL } })
  try {
    const done = await run(fake, [...himalayaArgv(config, GMAIL.profileGet.path, [])])
    expect(JSON.parse(done.stdout)).toEqual({ email: EMAIL })
  } finally {
    await fake.stop()
  }
})

test("a verb the table does not have is clap's refusal, exit 2, naming what it speaks", async () => {
  const { fake, config } = await startedFake({ profile: { email: EMAIL } })
  try {
    const done = await run(fake, [...himalayaArgv(config, ["gmail", "threads", "delete"], [])])
    expect(done.code).toBe(2)
    expect(done.stdout).toBe("")
    expect(done.stderr).toContain("error: unrecognized subcommand 'gmail threads delete'")
    // The half a person needs: what this fake DOES answer, from the table's own
    // `says`, so an unoffered verb cannot be mistaken for a broken mailbox.
    expect(done.stderr).toContain("profile.get")
    expect(done.stderr).toContain(GMAIL.profileGet.says)
  } finally {
    await fake.stop()
  }
})

test("an invocation with no --json is refused rather than answered in an unreadable shape", async () => {
  const { fake, config } = await startedFake({ profile: { email: EMAIL } })
  try {
    const done = await run(fake, ["-c", config, ...GMAIL.profileGet.path])
    expect(done.code).toBe(2)
    expect(done.stdout).toBe("")
    expect(done.stderr).toContain("--json")
  } finally {
    await fake.stop()
  }
})

test("a --config that names no file stops the verb before it is answered", async () => {
  const { fake } = await startedFake({ profile: { email: EMAIL } })
  try {
    const gone = [...himalayaArgv(path.join(path.dirname(fake.fixturePath), "never-written.toml"), GMAIL.profileGet.path, [])]
    const done = await run(fake, gone)
    expect(done.code).toBe(2)
    expect(done.stdout).toBe("")
    expect(done.stderr).toContain("never-written.toml")
  } finally {
    await fake.stop()
  }
})

test("the fixture's failure is the JSON error on stdout, exit 1, stderr empty", async () => {
  const sentence = "Gmail refused this request: the access token is expired"
  const { fake, config } = await startedFake({ profile: { email: EMAIL }, failure: sentence })
  try {
    const done = await run(fake, [...himalayaArgv(config, GMAIL.profileGet.path, [])])
    expect(done.code).toBe(1)
    expect(done.stderr).toBe("")
    expect(JSON.parse(done.stdout)).toEqual({ error: sentence, sources: [], backtrace: null })
    // A version is still a version: the pin is not a permission.
    const version = await run(fake, ["--version"])
    expect(version.code).toBe(0)
  } finally {
    await fake.stop()
  }
})

test("rewrite moves what the next call answers, both ways", async () => {
  const { fake, config } = await startedFake({ profile: { email: EMAIL } })
  try {
    expect(JSON.parse((await run(fake, [...himalayaArgv(config, GMAIL.profileGet.path, [])])).stdout).email).toBe(EMAIL)
    fake.rewrite({ profile: { email: EMAIL }, failure: "the token was revoked while you were reading" })
    const refused = await run(fake, [...himalayaArgv(config, GMAIL.profileGet.path, [])])
    expect(refused.code).toBe(1)
    fake.rewrite({ profile: { email: "second@olai.invalid" } })
    const recovered = await run(fake, [...himalayaArgv(config, GMAIL.profileGet.path, [])])
    expect(recovered.code).toBe(0)
    expect(JSON.parse(recovered.stdout).email).toBe("second@olai.invalid")
  } finally {
    await fake.stop()
  }
})

test("the whole flow: consent, exchange, refresh and revoke, with every request recorded", async () => {
  const google = await startFakeGoogleFor({ email: EMAIL })
  try {
    const state = newState()
    const first = verifier(1)
    const back = await consented(google, first, state)
    expect(back.searchParams.get("state")).toBe(state)
    const code = back.searchParams.get("code") ?? ""
    expect(code).not.toBe("")

    const granted = await exchanged(google, code, first)
    expect(granted.status).toBe(200)
    const tokens = await granted.json() as {
      readonly access_token: string
      readonly refresh_token: string
      readonly expires_in: number
      readonly scope: string
      readonly token_type: string
    }
    expect(tokens.token_type).toBe("Bearer")
    expect(tokens.expires_in).toBe(3600)
    expect(tokens.scope).toBe("https://www.googleapis.com/auth/gmail.modify")
    expect(google.issued()).toEqual([tokens.access_token])

    // The refresh — and Google's own shape when it is not rotating: no new
    // refresh token, which `../../oauth.ts` reads as *keep the one you have*.
    const refresh = refreshRequest(endpointsAt(google.origin), { client: CLIENT, secret: SECRET, refreshToken: tokens.refresh_token })
    const refreshed = await fetch(refresh.url, { method: "POST", headers: { "content-type": FORM_CONTENT_TYPE }, body: refresh.body })
    expect(refreshed.status).toBe(200)
    const next = await refreshed.json() as Record<string, unknown>
    expect(next["refresh_token"]).toBeUndefined()
    expect(next["access_token"]).not.toBe(tokens.access_token)
    expect(google.issued()).toHaveLength(2)

    const revoke = revokeRequest(endpointsAt(google.origin), tokens.refresh_token)
    const revoked = await fetch(revoke.url, { method: "POST", headers: { "content-type": FORM_CONTENT_TYPE }, body: revoke.body })
    expect(revoked.status).toBe(200)
    expect(google.revoked()).toEqual([tokens.refresh_token])

    // WHAT WAS SENT, in order — the record a scenario's assertions are built on.
    expect(google.requests().map((one) => `${one.method} ${one.path}`)).toEqual([
      "GET /o/oauth2/v2/auth",
      "POST /token",
      "POST /token",
      "POST /revoke",
    ])
    const asked = new URLSearchParams(google.requests()[0]?.query ?? "")
    expect(asked.get("access_type")).toBe("offline")
    expect(asked.get("prompt")).toBe("consent")
    expect(asked.get("code_challenge_method")).toBe("S256")
    expect(new URLSearchParams(google.requests()[1]?.body ?? "").get("grant_type")).toBe("authorization_code")
  } finally {
    await google.stop()
  }
})

test("a consent request that would not earn a refresh token is refused, with a sentence", async () => {
  const google = await startFakeGoogleFor({ email: EMAIL })
  try {
    const endpoints = endpointsAt(google.origin)
    const asked = authorizationUrl(endpoints, { client: CLIENT, redirect: REDIRECT, state: "s", challenge: challengeOf(verifier(2)) })
    // The two parameters that TOGETHER are what make Google hand back a refresh
    // token — each one dropped on its own, so neither can pass for the other.
    for (const dropped of ["access_type", "prompt"]) {
      const holes = new URL(asked)
      holes.searchParams.delete(dropped)
      const response = await fetch(holes, { redirect: "manual" })
      expect(response.status, dropped).toBe(400)
      expect(await response.text(), dropped).toContain(EMAIL)
    }
    // ...and a challenge that is not a hash makes the code worth stealing.
    const plain = new URL(asked)
    plain.searchParams.set("code_challenge_method", "plain")
    expect((await fetch(plain, { redirect: "manual" })).status).toBe(400)
  } finally {
    await google.stop()
  }
})

test("a code_verifier that does not hash to the challenge is invalid_grant", async () => {
  const google = await startFakeGoogleFor({ email: EMAIL })
  try {
    const back = await consented(google, verifier(3), "state-3")
    const response = await exchanged(google, back.searchParams.get("code") ?? "", verifier(4))
    expect(response.status).toBe(400)
    const said = await response.json() as Record<string, unknown>
    expect(said["error"]).toBe("invalid_grant")
    expect(String(said["error_description"])).toContain("code_verifier")
  } finally {
    await google.stop()
  }
})

test("an authorization code is single-use", async () => {
  const google = await startFakeGoogleFor({ email: EMAIL })
  try {
    const once = verifier(5)
    const code = (await consented(google, once, "state-5")).searchParams.get("code") ?? ""
    expect((await exchanged(google, code, once)).status).toBe(200)
    const again = await exchanged(google, code, once)
    expect(again.status).toBe(400)
    expect((await again.json() as Record<string, unknown>)["error"]).toBe("invalid_grant")
  } finally {
    await google.stop()
  }
})

test('refresh: "invalid_grant" answers exactly what the plugin\'s fault arm reads', async () => {
  const google = await startFakeGoogleFor({ email: EMAIL, refresh: "invalid_grant" })
  try {
    const refresh = refreshRequest(endpointsAt(google.origin), { client: CLIENT, secret: SECRET, refreshToken: "1//olai-fake-1" })
    const response = await fetch(refresh.url, { method: "POST", headers: { "content-type": FORM_CONTENT_TYPE }, body: refresh.body })
    expect(response.status).toBe(400)
    const body = await response.text()
    expect((JSON.parse(body) as Record<string, unknown>)["error"]).toBe("invalid_grant")
    // The plugin's own reading of that answer: a refusal the panel can word,
    // rather than a throw.
    const answered = tokenAnswer(response.status, body)
    expect(answered.ok).toBe(false)
    if (!answered.ok) expect(answered.error).toBe("invalid_grant")
  } finally {
    await google.stop()
  }
})

test("rewrite moves what the token endpoint answers, on the same origin", async () => {
  const google = await startFakeGoogleFor({ email: EMAIL, refresh: "invalid_grant" })
  try {
    const refresh = refreshRequest(endpointsAt(google.origin), { client: CLIENT, secret: SECRET, refreshToken: "1//olai-fake-1" })
    const asked = { method: "POST", headers: { "content-type": FORM_CONTENT_TYPE }, body: refresh.body }
    expect((await fetch(refresh.url, asked)).status).toBe(400)
    // The arm a scenario's fault-and-recover path needs, and the reason it
    // cannot start a second fake: a serve was SPAWNED with this origin.
    google.rewrite({ email: EMAIL, refresh: "ok", accessToken: "ya29.moved", expiresIn: 90 })
    const recovered = await fetch(refresh.url, asked)
    expect(recovered.status).toBe(200)
    const tokens = await recovered.json() as Record<string, unknown>
    expect(tokens["access_token"]).toBe("ya29.moved")
    expect(tokens["expires_in"]).toBe(90)
    expect(google.issued()).toEqual(["ya29.moved"])
    // A rewrite moves what the fake SAYS: the conversation so far is still
    // there for a scenario to assert over, both halves of it.
    expect(google.requests()).toHaveLength(2)
    // ...and a fixture with no account is refused where it is written, not at
    // the next request.
    expect(() => google.rewrite({ email: " " })).toThrow()
  } finally {
    await google.stop()
  }
})

test("every structured fake answer validates against the built Himalaya schemas", async () => {
  const { default: Ajv } = await import("ajv/dist/2020.js")
  const { readFileSync, writeFileSync, mkdtempSync, rmSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { mailAnswer } = await import("./fake-himalaya.ts")
  const { GMAIL } = await import("../../himalaya/verbs.ts")
  const directory = mkdtempSync(join(tmpdir(), "mail-schema-test-"))
  writeFileSync(join(directory, "message.eml"), "To: r@example.com\r\nSubject: Hello\r\n\r\naGVsbG8=\r\n")
  const ajv = new Ajv({ strict: false, validateFormats: false })
  try {
    for (const [verb, args] of [
      [GMAIL.threadsList, ["-s", "2"]],
      [GMAIL.threadsGet, ["a3", "--format", "full"]],
      [GMAIL.threadsGet, ["a2", "--format", "metadata"]],
      [GMAIL.labelsList, []],
      [GMAIL.draftsCreate, ["--", join(directory, "message.eml")]],
      [GMAIL.draftsUpdate, ["draft_1", "--thread-id", "a2", "--", join(directory, "message.eml")]],
      [GMAIL.historyList, ["--start-history-id", "100", "--label-id", "INBOX", "--history-type", "messageAdded", "-s", "500"]],
    ] as const) {
      const schema = JSON.parse(readFileSync(new URL(`../../himalaya/schemas/himalaya-gmail-${verb.id.replace(".", "-")}.json`, import.meta.url), "utf8"))
      const validate = ajv.compile(schema)
      const answer = mailAnswer(verb, args, directory)
      expect(answer.code).toBe(0)
      const valid = validate(JSON.parse(answer.stdout))
      expect(validate.errors).toBeNull()
      expect(valid).toBe(true)
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})


test("history retains arrival labels and thread ids, pages, and expires", async () => {
  const { default: Ajv } = await import("ajv/dist/2020.js")
  const { readFileSync } = await import("node:fs")
  const { fake, config } = await startedFake({ mailbox: true, profile: { email: EMAIL } })
  const schema = JSON.parse(readFileSync(new URL("../../himalaya/schemas/himalaya-gmail-history-list.json", import.meta.url), "utf8"))
  const valid = new Ajv({ strict: false, validateFormats: false }).compile(schema)
  const args = ["--start-history-id", "100", "--label-id", "INBOX", "--history-type", "messageAdded", "-s", "500"]
  try {
    fake.deliver("b1", "one")
    fake.deliver("b2", "two", false)
    fake.deliver("b3", "three")
    const first = JSON.parse((await run(fake, himalayaArgv(config, GMAIL.historyList.path, args))).stdout)
    expect(valid(first)).toBe(true)
    expect(first.history).toHaveLength(2)
    expect(first.history[0]["messages-added-details"][0]["thread-id"]).toBe("b1")
    expect(first.history[1]["messages-added-details"][0]["label-ids"]).not.toContain("INBOX")
    const second = JSON.parse((await run(fake, himalayaArgv(config, GMAIL.historyList.path, [...args, "--page-token", first.next_page]))).stdout)
    expect(valid(second)).toBe(true)
    expect(second.history).toHaveLength(1)
    expect(second.next_page).toBeNull()
    fake.expireHistory()
    expect((await run(fake, himalayaArgv(config, GMAIL.historyList.path, args))).stdout).toContain("404")
  } finally { await fake.stop() }
})

test("neither messages send nor drafts send is in the table or accepted by the fake", async () => {
  const { fake, config } = await startedFake({ mailbox: true, profile: { email: EMAIL } })
  try {
    expect(fake.speaks.some(verb => verb.endsWith(".send"))).toBe(false)
    for (const group of ["messages", "drafts"]) {
      const answer = await run(fake, himalayaArgv(config, ["gmail", group, "send"], ["draft_1"]))
      expect(answer.code).toBe(2)
      expect(answer.stderr).toContain("unrecognized subcommand")
    }
  } finally { await fake.stop() }
})

test("the fake reads back every filename the composer can write, including a bare name=", async () => {
  const { Result } = await import("effect")
  const { compose } = await import("../../compose.ts")
  const names = ["invoice.pdf", "Café ☕.txt", 'say "hi".txt', "back\\slash.txt"]
  const message = Result.getOrThrow(compose(
    { from: EMAIL, to: ["ravi@example.com"], subject: "Files", body: "See attached" },
    names.map(filename => ({ filename, type: "application/octet-stream", data: Buffer.from(filename) })),
  ))
  const [head, ...rest] = message.split("\r\n\r\n")
  const contentType = head!.split("\r\n").find(line => line.startsWith("Content-Type:"))!.slice("Content-Type:".length).trim()
  const read = draftContents(contentType, rest.join("\r\n\r\n"))
  expect(read.body).toBe("See attached")
  expect(read.attachments.map(one => one.filename)).toEqual(names)
  expect(read.attachments.map(one => one.bytes)).toEqual(names.map(name => Buffer.byteLength(name)))
  // ...and a mailer that names the file only on the type, in an RFC 2047 word,
  // which is the half of `partFilename` the composer's own output never reaches.
  const boundary = /boundary="([^"]+)"/.exec(contentType)![1]!
  const bare = [
    `--${boundary}`,
    `Content-Type: text/plain; name="=?UTF-8?B?${Buffer.from('say "hi".txt').toString("base64")}?="`,
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("notes").toString("base64"),
    `--${boundary}--`,
    "",
  ].join("\r\n")
  const one = draftContents(contentType, `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from("hi").toString("base64")}\r\n${bare}`)
  expect(one.attachments.map(each => each.filename)).toEqual(['say "hi".txt'])
})
