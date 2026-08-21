/**
 * Who this connection is: the header, the gravatar, the HTTP door.
 *
 * Two layers, and they are not the same test. {@link identityOf} is the
 * seam — present, absent, blank, doubled — and a later `/capture` will
 * call it without going through this route. {@link gravatarOf} is the hash
 * and the generic fallback. The rest drive a real listener, because the
 * chip's "mocked header" is a property of the serving stack, not of the
 * parse.
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"

import {
  GRAVATAR_ORIGIN,
  gravatarOf,
  identityOf,
  LOGIN_HEADER,
  shown,
  WHO_PATH,
} from "./identity.ts"
import { served, withServing } from "./serve.testlib.ts"

const ADA = "ada@example.com"
/** MD5 of `ada@example.com`, the classic Gravatar contract. */
const ADA_HASH = "3e3417d7ef77d5932a6734b916515ed5"

test("a present login is that login, trimmed", () => {
  expect(identityOf({ [LOGIN_HEADER]: "  ada@example.com  " })).toEqual({
    login: ADA,
  })
  expect(identityOf({ "Tailscale-User-Login": ADA })).toEqual({ login: ADA })
})

test("absent, blank, or empty-after-trim is nobody — nothing guesses", () => {
  expect(identityOf({})).toBeNull()
  expect(identityOf({ [LOGIN_HEADER]: "" })).toBeNull()
  expect(identityOf({ [LOGIN_HEADER]: "   " })).toBeNull()
  expect(identityOf({ [LOGIN_HEADER]: undefined })).toBeNull()
})

test("a doubled header is the first value, not a list of people", () => {
  expect(identityOf({ [LOGIN_HEADER]: [ADA, "other@example.com"] })).toEqual({
    login: ADA,
  })
})

test("the gravatar is the MD5 of the trimmed, lowercased login", () => {
  expect(gravatarOf(ADA)).toBe(`${GRAVATAR_ORIGIN}/avatar/${ADA_HASH}?d=mp`)
  expect(gravatarOf("  Ada@Example.COM  ")).toBe(gravatarOf(ADA))
})

test("the generic fallback is Gravatar's mystery person", () => {
  expect(gravatarOf(ADA).endsWith("?d=mp")).toBe(true)
})

test("what the chip is shown is the login and that gravatar", () => {
  expect(shown({ login: ADA })).toEqual({
    login: ADA,
    gravatar: gravatarOf(ADA),
  })
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
