/**
 * Who is looking, over a real listener: `GET /olai/who` and `who.get`.
 *
 * The person is `@olai/identity`'s and so is the picture ladder. This file
 * drives both doors, because the chip's "mocked header" is a property of
 * the serving stack, not of the parse: what a proxy actually injects
 * reaches the upgrade as headers, and what the browser is handed is one
 * JSON object with the picture ALREADY RESOLVED. {@link shown} is that
 * mapping. The HTTP door stays for a share sheet; the procedure is what
 * a tab that is already connected asks.
 */

import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { SURFACE_WS_PATH } from "@kolu/surface-app"
import {
  DEFAULT_IDENTITY_CONFIG,
  gravatarOf,
  type IdentityConfig,
} from "@olai/identity"
import { surface, WHO_PATH, type Who } from "@olai/surface"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"
import { WebSocket as WsClient } from "ws"

import { shown } from "./identity.ts"
import { served, withServing } from "./serve.testlib.ts"

const ADA = "ada@example.com"
const GITHUB = "https://github.com/{login}.png"

/** An Authelia-shaped serve, which sends no picture of its own. */
const authelia: IdentityConfig = {
  headers: {
    login: "Remote-User",
    email: "Remote-Email",
    name: "Remote-Name",
    picture: null,
  },
  avatarTemplate: null,
}

test("the door hands over the picture the ladder resolved, not a rule", () => {
  const srid = { login: "srid@github", email: "srid@github", name: null }
  expect(shown({ ...srid, picture: null }, null)).toEqual({
    login: "srid@github",
    name: null,
    // The motivating case: a GitHub-backed tailnet's login is not an
    // address, so there is no gravatar to hash and no picture to draw.
    picture: null,
  })
  expect(shown({ ...srid, picture: null }, GITHUB).picture).toBe(
    "https://github.com/srid%40github.png",
  )
  expect(
    shown({ ...srid, picture: "https://avatars.example/srid.png" }, GITHUB)
      .picture,
  ).toBe("https://avatars.example/srid.png")
  expect(
    shown({ login: ADA, email: ADA, name: "Ada", picture: null }, null),
  ).toEqual({ login: ADA, name: "Ada", picture: gravatarOf(ADA) })
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
      name: null,
      picture: gravatarOf(ADA),
    })
  })
})

test("tailscale's profile picture and name are what the chip is handed", async () => {
  await withServing({ root: served() }, async (url) => {
    const answer = await get(url, WHO_PATH, {
      "Tailscale-User-Login": "srid@github",
      "Tailscale-User-Name": "Sridhar Ratnakumar",
      "Tailscale-User-Profile-Pic": "https://avatars.example/srid.png",
    })
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({
      login: "srid@github",
      name: "Sridhar Ratnakumar",
      picture: "https://avatars.example/srid.png",
    })
  })
})

test("a login that is not an address draws no picture, and still someone", async () => {
  await withServing({ root: served() }, async (url) => {
    const answer = await get(url, WHO_PATH, {
      "Tailscale-User-Login": "srid@github",
      "Tailscale-User-Name": "Sridhar Ratnakumar",
    })
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({
      login: "srid@github",
      name: "Sridhar Ratnakumar",
      picture: null,
    })
  })
})

test("an avatar template pictures that same login, with no API and no token", async () => {
  await withServing(
    { root: served(), identity: { ...DEFAULT_IDENTITY_CONFIG, avatarTemplate: GITHUB } },
    async (url) => {
      const answer = await get(url, WHO_PATH, {
        "Tailscale-User-Login": "srid",
      })
      expect(answer.status).toBe(200)
      expect(JSON.parse(answer.body)).toEqual({
        login: "srid",
        name: null,
        picture: "https://github.com/srid.png",
      })
    },
  )
})

test("Authelia headers on a serve configured for them are this request's who", async () => {
  await withServing({ root: served(), identity: authelia }, async (url) => {
    const answer = await get(url, WHO_PATH, {
      "Remote-User": "ada",
      "Remote-Email": ADA,
      "Remote-Name": "Ada Lovelace",
    })
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({
      login: "ada",
      name: "Ada Lovelace",
      picture: gravatarOf(ADA),
    })
  })
})

test("a login with no email claim is still someone, with no picture", async () => {
  await withServing({ root: served(), identity: authelia }, async (url) => {
    const answer = await get(url, WHO_PATH, { "Remote-User": "ada" })
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({
      login: "ada",
      name: null,
      picture: null,
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

/** A real websocket, dialled the way a tab does, with the headers a proxy
 *  would have stamped on the upgrade. */
const withWhoSocket = (
  headers: Record<string, string> | undefined,
  body: (ask: () => Promise<Who | null>) => Promise<void>,
  identity?: IdentityConfig,
): Promise<void> =>
  withServing({ root: served(), identity }, async (url) => {
    const socket = await createSurfaceSocket({
      group: surface.group,
      url: `${url.replace("http://", "ws://")}${SURFACE_WS_PATH}`,
      retired: () => {},
      connect: (target) =>
        new WsClient(
          target,
          headers === undefined ? undefined : { headers },
        ) as unknown as WebSocket,
    })
    try {
      await body(() =>
        Effect.runPromise(
          socket.link.dispatch.unary("surface/who/get", {}) as Effect.Effect<
            Who | null
          >,
        ),
      )
    } finally {
      await socket.dispose()
    }
  })

test("a tab with no login is nobody, and did not have to GET /olai/who", async () => {
  await withWhoSocket(undefined, async (ask) => {
    expect(await ask()).toBeNull()
  })
})

test("a mocked Tailscale-User-Login on the upgrade is this connection's who", async () => {
  await withWhoSocket(
    { "Tailscale-User-Login": ADA },
    async (ask) => {
      expect(await ask()).toEqual({
        login: ADA,
        name: null,
        picture: gravatarOf(ADA),
      })
    },
  )
})

test("the upgrade's identity is per connection, not a process cell", async () => {
  await withServing({ root: served() }, async (url) => {
    const socket = await createSurfaceSocket({
      group: surface.group,
      url: `${url.replace("http://", "ws://")}${SURFACE_WS_PATH}`,
      retired: () => {},
      connect: (target) =>
        new WsClient(target, {
          headers: { "Tailscale-User-Login": ADA },
        }) as unknown as WebSocket,
    })
    try {
      expect(
        await Effect.runPromise(
          socket.link.dispatch.unary("surface/who/get", {}) as Effect.Effect<
            Who | null
          >,
        ),
      ).toEqual({ login: ADA, name: null, picture: gravatarOf(ADA) })
      // A later HTTP request that carries no header is still nobody: the
      // upgrade did not write a process-wide cell.
      const door = await get(url, WHO_PATH)
      expect(door.status).toBe(204)
    } finally {
      await socket.dispose()
    }
  })
})

test("a sealed page keeps its own policy, with no picture hole", async () => {
  const root = served()
  fs.writeFileSync(path.join(root, "page.html"), "<!doctype html><p>hi</p>")
  try {
    await withServing({ root }, async (url) => {
      const page = await get(url, "/media/page.html")
      expect(page.status).toBe(200)
      const policy = String(page.headers["content-security-policy"] ?? "")
      expect(policy.length).toBeGreaterThan(0)
      expect(policy).not.toContain("gravatar.com")
      expect(policy).not.toContain("img-src https:")
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
