/**
 * The chip's door: `GET /olai/who` over a real listener.
 *
 * The person is `@olai/identity`'s. This file drives the HTTP adapter,
 * because the chip's "mocked header" is a property of the serving stack,
 * not of the parse. {@link shown} is the mapping onto the surface's
 * `Who` — login plus picture — so a login with no email claim is still
 * someone, with the generic silhouette.
 */

import { GENERIC_GRAVATAR, gravatarOf } from "@olai/identity"
import { WHO_PATH } from "@olai/surface"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"

import { shown } from "./identity.ts"
import { served, withServing } from "./serve.testlib.ts"

const ADA = "ada@example.com"

test("no email claim draws the generic silhouette, not a hash of the login", () => {
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
