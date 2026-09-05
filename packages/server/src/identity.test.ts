/**
 * Who is looking, over a real listener: `GET /olai/who` and `who.get`.
 *
 * The person and the picture ladder are the identity ROW's, behind the
 * `Identity` door core defines — so what is left to this file is the two
 * doors, which are the serving stack's and are exactly what a unit test of
 * the reading cannot reach: what a proxy injects arrives on a real upgrade
 * as real headers, and what the browser is handed is one JSON object with
 * the picture already resolved. The mapping and the ladder are pinned in
 * the row's own package (`packages/plugins/identity/src/who/`).
 *
 * A DEPLOYMENT IS STATED AS AN ENVIRONMENT here, because that is where the
 * row reads its header names from — `vars` on the harness rather than the
 * parsed `IdentityConfig` core used to carry in order to hand it back.
 *
 * ...and the last test is the phase's own claim: a serve that does not
 * compose the row answers nobody for a request a full serve would have
 * named, which is "no provider mounted" said by the one door that can say
 * it without a browser.
 */

import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { SURFACE_WS_PATH } from "@kolu/surface-app"
import { surface, WHO_PATH, type Who } from "@olai/surface"
// THE ROW'S OWN HASH, imported rather than typed out: the gravatar a chip
// draws is one spelling, and a second one here would go on passing after the
// first moved. It is the same carve-out `headless.test.ts` takes on git's
// testlib, through a door with no runtime in it.
import { gravatarOf } from "olai-plugin-identity/who"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"
import { WebSocket as WsClient } from "ws"

import { served, withServing } from "./serve.testlib.ts"

const ADA = "ada@example.com"
const GITHUB = "https://github.com/{login}.png"

/** An Authelia-shaped serve, stated the way an operator states one: the
 *  environment the identity row reads, with no picture header of its own. */
const AUTHELIA = {
  OLAI_IDENTITY_LOGIN_HEADER: "Remote-User",
  OLAI_IDENTITY_EMAIL_HEADER: "Remote-Email",
  OLAI_IDENTITY_NAME_HEADER: "Remote-Name",
  OLAI_IDENTITY_PICTURE_HEADER: "",
}

/** ...and the default one, spelled out rather than inherited: this process's
 *  own environment may carry a developer's avatar template
 *  (`OLAI_IDENTITY_AVATAR_TEMPLATE`), and a serve that picked it up would
 *  picture a login the silhouette tests say wears nothing. The e2e harness
 *  strips the same family for the same reason. */
const TAILSCALE: Record<string, string | undefined> = {}

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
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
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
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
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
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
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
    { root: served(), vars: { OLAI_IDENTITY_AVATAR_TEMPLATE: GITHUB } },
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
  await withServing({ root: served(), vars: AUTHELIA }, async (url) => {
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
  await withServing({ root: served(), vars: AUTHELIA }, async (url) => {
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
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
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
  vars: Record<string, string | undefined> = TAILSCALE,
): Promise<void> =>
  withServing({ root: served(), vars }, async (url) => {
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
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
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

test("a serve that did not name the identity row is nobody, whoever asks", async () => {
  // THE PHASE'S OWN CLAIM, at the door that can say it without a browser: the
  // header is the one a full serve reads as Ada, and nobody is reading it. Not
  // a refusal and not an error — a 204, which is the same answer this door
  // gives a request that arrived behind no proxy at all.
  await withServing(
    { root: served(), vars: TAILSCALE, plugins: ["chat", "git"] },
    async (url) => {
      const answer = await get(url, WHO_PATH, { "Tailscale-User-Login": ADA })
      expect(answer.status).toBe(204)
      expect(answer.body).toBe("")
    },
  )
})

test("...and a tab on that serve is nobody on its own upgrade", async () => {
  // The other door, and the one that cannot be re-asked: the upgrade named no
  // headers at the bind because nobody was standing behind the door to name
  // any, so the socket is carrying nothing to read.
  await withServing(
    { root: served(), vars: TAILSCALE, plugins: ["chat", "git"] },
    async (url) => {
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
        ).toBeNull()
      } finally {
        await socket.dispose()
      }
    },
  )
})

test("a sealed page keeps its own policy, with no picture hole", async () => {
  const root = served()
  fs.writeFileSync(path.join(root, "page.html"), "<!doctype html><p>hi</p>")
  try {
    await withServing({ root, vars: TAILSCALE }, async (url) => {
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
