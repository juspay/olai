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

/**
 * ONE SOCKET, dialled the way a tab does, with the headers a proxy would have
 *  stamped on the upgrade — and disposed however the body ends.
 *
 * Every case below that reaches the tab's door reaches it through here. Five
 * copies of this block is what the file had, which is five places for a dial to
 * go stale and one reason each of them would have to be found separately.
 */
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

/** WHO THIS CONNECTION IS, over a socket of its own — which is the whole of
 *  what the tab's door answers, so the socket has nothing else to do and is
 *  closed as soon as it has said. */
const whoOn = (
  url: string,
  headers?: Record<string, string>,
): Promise<Who | null> =>
  onSocket(url, headers, async (call) =>
    (await call("surface/who/get", {})) as Who | null
  )

/** ...and the panel's own switch, which is what a person presses. */
const flip = (url: string, name: string, enabled: boolean): Promise<void> =>
  onSocket(url, undefined, async (call) => {
    await call("surface/plugins/set", { name, enabled })
  })

test("a tab with no login is nobody, and did not have to GET /olai/who", async () => {
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
    expect(await whoOn(url)).toBeNull()
  })
})

test("a mocked Tailscale-User-Login on the upgrade is this connection's who", async () => {
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
    expect(await whoOn(url, { "Tailscale-User-Login": ADA })).toEqual({
      login: ADA,
      name: null,
      picture: gravatarOf(ADA),
    })
  })
})

test("the upgrade's identity is per connection, not a process cell", async () => {
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
    expect(await whoOn(url, { "Tailscale-User-Login": ADA })).toEqual({
      login: ADA,
      name: null,
      picture: gravatarOf(ADA),
    })
    // A later HTTP request that carries no header is still nobody: the
    // upgrade did not write a process-wide cell.
    expect((await get(url, WHO_PATH)).status).toBe(204)
  })
})

/**
 * A FLIP IS IMMEDIATE, AND BOTH WAYS — the claim the per-call read of the door
 * makes, asked rather than assumed.
 *
 * The panel's own verb (`plugins.set`) is what a person presses, so it is what
 * this drives: switch the row off and the two doors answer nobody for a request
 * carrying a login a moment ago read as Ada; switch it back on and the same
 * request is Ada again. The second half is the half worth having — it is what
 * says the header ALLOWLIST survived the flip.
 *
 * A SOCKET PER ASK, because who is looking is stamped at the upgrade: a
 * connection opened before the flip is holding an answer from before it, which
 * is not a staleness to fix but the value's own definition.
 */
test("a row switched off is nobody at once, and switched back on is Ada again", async () => {
  await withServing({ root: served(), vars: TAILSCALE }, async (url) => {
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
  // The other door: nobody is standing behind the door to name a header, so
  // the upgrade keeps none and the socket is carrying nothing to read.
  await withServing(
    { root: served(), vars: TAILSCALE, plugins: ["chat", "git"] },
    async (url) => {
      expect(await whoOn(url, { "Tailscale-User-Login": ADA })).toBeNull()
    },
  )
})

/**
 * ...AND THE ROW SWITCHED ON AFTER THE BIND IS READ BY THE NEXT UPGRADE — 14a,
 * and the one claim the two tests above could not make between them.
 *
 * This is the state the seam used to get wrong, and it is worth stating as the
 * state rather than as the sequence: a serve that came up WITHOUT the identity
 * row and had it switched on at the panel must be indistinguishable, from the
 * next socket on, from a serve that booted with it. It was not. The allowlist
 * was fixed when the port bound, so `GET /olai/who` started answering Ada at
 * once while every socket — the open ones AND every new one — stayed anonymous
 * until somebody restarted the process.
 *
 * The header is the only thing under test here. The reading was already live
 * (the flip test above), so what this asks is whether the upgrade KEPT the
 * header for the reading to read: an allowlist still empty from the bind is a
 * socket carrying nothing, and `whoOn` answers `null` no matter how correct
 * everything downstream of it is.
 *
 * A NEW SOCKET, because a connection holds the headers its own upgrade
 * carried — the tab that redials when the roster moves is where a person meets
 * this — and the HTTP door is asked beside it so the two answers are compared
 * on one serve rather than assumed to agree.
 */
test("a row switched on after the bind names its headers on the next upgrade", async () => {
  await withServing(
    { root: served(), vars: TAILSCALE, plugins: ["chat", "git"] },
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

/**
 * A HEADER NAME NO REQUEST CAN CARRY STILL REFUSES THE BOOT — the loudness the
 * bind used to provide, kept on purpose, and the reason the accept-time read is
 * safe to have.
 *
 * A list read per accept CANNOT refuse a socket for a bad name: one row's typo
 * would take down every other tenant of the wire, so upstream serves that
 * connection with nothing named and narrates it. That is the right answer for a
 * row switched on mid-serve and the wrong loudness for the case an operator
 * actually meets — a space in `OLAI_IDENTITY_LOGIN_HEADER`, in a unit file, on
 * a serve that is starting right now — which is why `./serve.ts` spends the
 * framework's own check on the list this serve comes up with.
 *
 * The MESSAGE is the framework's and is asserted as such: it is the one thing
 * an operator has to act on, and a serve that refused with a sentence about
 * something else would send them to the wrong file.
 */
test("a header name no request can carry refuses the serve, in the framework's words", async () => {
  const refusal = await withServing(
    {
      root: served(),
      vars: { ...TAILSCALE, OLAI_IDENTITY_LOGIN_HEADER: "Remote User" },
      // THE ROW UNDER TEST AND NOTHING ELSE, which is the one place in this
      // file a narrow composition is about the harness rather than about a
      // claim: a refused boot unwinds rows that are already running, and the
      // appliance row dials a socket on its way down whether or not anything
      // is listening. What is being asked here is what the serve refuses WITH,
      // not what a teardown says while it happens.
      plugins: ["identity"],
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
