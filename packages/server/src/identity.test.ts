/**
 * Who this request is: the header names, the gravatar, the HTTP door.
 *
 * Three layers, and they are not the same test. {@link identityHeaders} is
 * the config — Tailscale by default, Caddy / Authelia by renaming the
 * pair. {@link identityOf} is the seam — present, absent, blank, doubled,
 * login without an email claim. {@link gravatarOf} is the hash and the
 * generic fallback. The rest drive a real listener, because the chip's
 * "mocked header" is a property of the serving stack, not of the parse.
 */

import { afterEach, expect, test } from "bun:test"
import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"

import {
  DEFAULT_IDENTITY_HEADERS,
  DEFAULT_LOGIN_HEADER,
  EMAIL_ENV,
  GENERIC_GRAVATAR,
  GRAVATAR_ORIGIN,
  gravatarOf,
  identityHeaders,
  identityOf,
  LOGIN_ENV,
  shown,
  WHO_PATH,
} from "./identity.ts"
import { served, withServing } from "./serve.testlib.ts"

const ADA = "ada@example.com"
/** MD5 of `ada@example.com`, the classic Gravatar contract. */
const ADA_HASH = "3e3417d7ef77d5932a6734b916515ed5"

const loginWas = process.env[LOGIN_ENV]
const emailWas = process.env[EMAIL_ENV]
afterEach(() => {
  if (loginWas === undefined) delete process.env[LOGIN_ENV]
  else process.env[LOGIN_ENV] = loginWas
  if (emailWas === undefined) delete process.env[EMAIL_ENV]
  else process.env[EMAIL_ENV] = emailWas
})

test("unset is tailscale serve: one header, and it is the email", () => {
  delete process.env[LOGIN_ENV]
  delete process.env[EMAIL_ENV]
  expect(identityHeaders()).toEqual(DEFAULT_IDENTITY_HEADERS)
  expect(DEFAULT_IDENTITY_HEADERS).toEqual({
    login: DEFAULT_LOGIN_HEADER,
    email: DEFAULT_LOGIN_HEADER,
  })
})

test("OLAI_IDENTITY_LOGIN_HEADER is the name", () => {
  process.env[LOGIN_ENV] = "Remote-User"
  delete process.env[EMAIL_ENV]
  expect(identityHeaders()).toEqual({
    login: "Remote-User",
    email: "Remote-User",
  })
})

test("an email header is a second name; empty is no email claim", () => {
  process.env[LOGIN_ENV] = "Remote-User"
  process.env[EMAIL_ENV] = "Remote-Email"
  expect(identityHeaders()).toEqual({
    login: "Remote-User",
    email: "Remote-Email",
  })
  process.env[EMAIL_ENV] = ""
  expect(identityHeaders()).toEqual({ login: "Remote-User", email: null })
  process.env[EMAIL_ENV] = "  "
  expect(identityHeaders()).toEqual({ login: "Remote-User", email: null })
})

test("the environment is read per call, not once at import", () => {
  process.env[LOGIN_ENV] = "X-Auth-Request-User"
  process.env[EMAIL_ENV] = "X-Auth-Request-Email"
  expect(identityHeaders().login).toBe("X-Auth-Request-User")
  process.env[LOGIN_ENV] = "X-Token-User-Nick"
  process.env[EMAIL_ENV] = "X-Token-User-Email"
  expect(identityHeaders()).toEqual({
    login: "X-Token-User-Nick",
    email: "X-Token-User-Email",
  })
})

test("a present login is that login, trimmed, with the email claim", () => {
  expect(identityOf({ "tailscale-user-login": "  ada@example.com  " })).toEqual({
    login: ADA,
    email: ADA,
  })
  expect(identityOf({ "Tailscale-User-Login": ADA })).toEqual({
    login: ADA,
    email: ADA,
  })
})

test("absent, blank, or empty-after-trim is nobody — nothing guesses", () => {
  expect(identityOf({})).toBeNull()
  expect(identityOf({ "tailscale-user-login": "" })).toBeNull()
  expect(identityOf({ "tailscale-user-login": "   " })).toBeNull()
  expect(identityOf({ "tailscale-user-login": undefined })).toBeNull()
})

test("a doubled header is the first value, not a list of people", () => {
  expect(
    identityOf({ "tailscale-user-login": [ADA, "other@example.com"] }),
  ).toEqual({ login: ADA, email: ADA })
})

test("Authelia names: login and email are two headers", () => {
  const names = { login: "Remote-User", email: "Remote-Email" }
  expect(
    identityOf(
      { "remote-user": "ada", "remote-email": ADA },
      names,
    ),
  ).toEqual({ login: "ada", email: ADA })
  expect(identityOf({ "remote-user": "ada" }, names)).toEqual({
    login: "ada",
    email: null,
  })
  expect(identityOf({ "remote-email": ADA }, names)).toBeNull()
})

test("oauth2-proxy names are the same pair under other words", () => {
  expect(
    identityOf(
      {
        "x-auth-request-user": "ada",
        "x-auth-request-email": ADA,
      },
      { login: "X-Auth-Request-User", email: "X-Auth-Request-Email" },
    ),
  ).toEqual({ login: "ada", email: ADA })
})

test("a config that named no email header carries no email claim", () => {
  expect(
    identityOf(
      { "remote-user": "ada" },
      { login: "Remote-User", email: null },
    ),
  ).toEqual({ login: "ada", email: null })
})

test("the gravatar is the MD5 of the trimmed, lowercased email", () => {
  expect(gravatarOf(ADA)).toBe(`${GRAVATAR_ORIGIN}/avatar/${ADA_HASH}?d=mp`)
  expect(gravatarOf("  Ada@Example.COM  ")).toBe(gravatarOf(ADA))
})

test("no email claim draws the generic silhouette, not a hash of the login", () => {
  expect(GENERIC_GRAVATAR.endsWith("?d=mp")).toBe(true)
  expect(shown({ login: "ada", email: null }).gravatar).toBe(GENERIC_GRAVATAR)
  expect(shown({ login: ADA, email: ADA }).gravatar).toBe(gravatarOf(ADA))
  expect(shown({ login: ADA, email: ADA }).gravatar).not.toBe(GENERIC_GRAVATAR)
})

const get = (
  url: string,
  pathname: string,
  headers: Record<string, string> = {},
): Promise<{
  status: number
  headers: http.IncomingHttpHeaders
  body: string
}> =>
  new Promise((resolve, reject) => {
    http.get(new URL(pathname, url), { headers }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk) => chunks.push(chunk as Buffer))
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      )
      res.on("error", reject)
    }).on("error", reject)
  })

test("a mocked Tailscale-User-Login is this request's who", async () => {
  await withServing({ root: served() }, async (url) => {
    const answer = await get(url, WHO_PATH, { "Tailscale-User-Login": ADA })
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({
      login: ADA,
      gravatar: gravatarOf(ADA),
    })
  })
})

test("Authelia headers on a serve configured for them are this request's who", async () => {
  await withServing(
    {
      root: served(),
      identity: { login: "Remote-User", email: "Remote-Email" },
    },
    async (url) => {
      const answer = await get(url, WHO_PATH, {
        "Remote-User": "ada",
        "Remote-Email": ADA,
      })
      expect(answer.status).toBe(200)
      expect(JSON.parse(answer.body)).toEqual({
        login: "ada",
        gravatar: gravatarOf(ADA),
      })
    },
  )
})

test("a login with no email claim is still someone, with the generic picture", async () => {
  await withServing(
    {
      root: served(),
      identity: { login: "Remote-User", email: "Remote-Email" },
    },
    async (url) => {
      const answer = await get(url, WHO_PATH, { "Remote-User": "ada" })
      expect(answer.status).toBe(200)
      expect(JSON.parse(answer.body)).toEqual({
        login: "ada",
        gravatar: GENERIC_GRAVATAR,
      })
    },
  )
})

test("a request with no login is nobody", async () => {
  await withServing({ root: served() }, async (url) => {
    const answer = await get(url, WHO_PATH)
    expect(answer.status).toBe(204)
    expect(answer.body).toBe("")
  })
})

test("a sealed page keeps its own policy, with no gravatar hole", async () => {
  const root = served()
  fs.writeFileSync(path.join(root, "page.html"), "<!doctype html><p>hi</p>")
  try {
    await withServing({ root }, async (url) => {
      const page = await get(url, "/media/page.html")
      expect(page.status).toBe(200)
      const policy = String(page.headers["content-security-policy"] ?? "")
      expect(policy.length).toBeGreaterThan(0)
      expect(policy).not.toContain("gravatar.com")
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
