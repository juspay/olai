import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { SURFACE_WS_PATH } from "@kolu/surface-app"
import { surface, WHO_PATH, type Who } from "@olai/surface"
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

const AUTHELIA = {
  "login-header": "Remote-User",
  "email-header": "Remote-Email",
  "name-header": "Remote-Name",
  "picture-header": "",
}

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
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
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
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
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
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
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
    { root: served(), policy: { identity: { "avatar-template": GITHUB } } },
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
  await withServing({ root: served(), policy: { identity: AUTHELIA } }, async (url) => {
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
  await withServing({ root: served(), policy: { identity: AUTHELIA } }, async (url) => {
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
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
    const answer = await get(url, WHO_PATH)
    expect(answer.status).toBe(204)
    expect(answer.body).toBe("")
  })
})

const onSocket = async <A>(
  url: string,
  headers: Record<string, string> | undefined,
  body: (call: (member: string, input: unknown) => Promise<unknown>) => Promise<A>,
): Promise<A> => {
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
    return await body((member, input) =>
      Effect.runPromise(
        socket.link.dispatch.unary(member, input) as Effect.Effect<unknown>,
      ),
    )
  } finally {
    await socket.dispose()
  }
}

const whoOn = (
  url: string,
  headers?: Record<string, string>,
): Promise<Who | null> =>
  onSocket(url, headers, async (call) =>
    (await call("surface/who/get", {})) as Who | null
  )

const flip = (url: string, name: string, enabled: boolean): Promise<void> =>
  onSocket(url, undefined, async (call) => {
    await call("surface/plugins/set", { name, enabled })
  })

test("a tab with no login is nobody, and did not have to GET /olai/who", async () => {
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
    expect(await whoOn(url)).toBeNull()
  })
})

test("a mocked Tailscale-User-Login on the upgrade is this connection's who", async () => {
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
    expect(await whoOn(url, { "Tailscale-User-Login": ADA })).toEqual({
      login: ADA,
      name: null,
      picture: gravatarOf(ADA),
    })
  })
})

test("the upgrade's identity is per connection, not a process cell", async () => {
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
    expect(await whoOn(url, { "Tailscale-User-Login": ADA })).toEqual({
      login: ADA,
      name: null,
      picture: gravatarOf(ADA),
    })
    expect((await get(url, WHO_PATH)).status).toBe(204)
  })
})

test("a row switched off is nobody at once, and switched back on is Ada again", async () => {
  await withServing({ root: served(), policy: { identity: TAILSCALE } }, async (url) => {
    const ada = { "Tailscale-User-Login": ADA }
    const someone = { login: ADA, name: null, picture: gravatarOf(ADA) }

    expect((await get(url, WHO_PATH, ada)).status).toBe(200)
    expect(await whoOn(url, ada)).toEqual(someone)

    await flip(url, "identity", false)
    expect((await get(url, WHO_PATH, ada)).status).toBe(204)
    expect(await whoOn(url, ada)).toBeNull()

    await flip(url, "identity", true)
    expect(JSON.parse((await get(url, WHO_PATH, ada)).body)).toEqual(someone)
    expect(await whoOn(url, ada)).toEqual(someone)
  })
})

test("a serve that did not name the identity row is nobody, whoever asks", async () => {
  await withServing(
    { root: served(), policy: { identity: TAILSCALE }, plugins: ["vault", "chat", "git", "ws", "web-app", "mcp"] },
    async (url) => {
      const answer = await get(url, WHO_PATH, { "Tailscale-User-Login": ADA })
      expect(answer.status).toBe(204)
      expect(answer.body).toBe("")
    },
  )
})

test("...and a tab on that serve is nobody on its own upgrade", async () => {
  await withServing(
    { root: served(), policy: { identity: TAILSCALE }, plugins: ["vault", "chat", "git", "ws", "web-app", "mcp"] },
    async (url) => {
      expect(await whoOn(url, { "Tailscale-User-Login": ADA })).toBeNull()
    },
  )
})

test("a row switched on after the bind names its headers on the next upgrade", async () => {
  await withServing(
    { root: served(), policy: { identity: TAILSCALE }, plugins: ["vault", "chat", "git", "ws", "web-app", "mcp"] },
    async (url) => {
      const ada = { "Tailscale-User-Login": ADA }
      const someone = { login: ADA, name: null, picture: gravatarOf(ADA) }

      expect(await whoOn(url, ada)).toBeNull()

      await flip(url, "identity", true)

      expect(await whoOn(url, ada)).toEqual(someone)
      expect(JSON.parse((await get(url, WHO_PATH, ada)).body)).toEqual(someone)
    },
  )
})

test("a header name no request can carry refuses the serve, in the framework's words", async () => {
  const refusal = await withServing(
    {
      root: served(),
      policy: { identity: { ...TAILSCALE, "login-header": "Remote User" } },
      plugins: ["vault", "identity", "ws", "web-app", "mcp"],
    },
    async () => "the serve came up",
  ).then(() => null, (error: unknown) => String(error))

  expect(refusal).toContain("Remote User")
  expect(refusal).toContain("is not an HTTP header name")
})

test("a sealed page keeps its own policy, with no picture hole", async () => {
  const root = served()
  fs.writeFileSync(path.join(root, "page.html"), "<!doctype html><p>hi</p>")
  try {
    await withServing({ root, policy: { identity: TAILSCALE } }, async (url) => {
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
