/**
 * The internal route, over real HTTP.
 *
 * This is the face olai's OWN agent talks to, and it had no test — which is how
 * the SSE default got as far as the e2e suite. The transport prefers an SSE
 * stream unless told otherwise, and a client that asked for
 * `application/json, text/event-stream` (every ACP agent does) and then called
 * `response.json()` waits on it forever. That is not a shape a unit test of the
 * face can see, because it is a property of the TRANSPORT and its headers.
 *
 * So the assertions here are deliberately about the envelope rather than about
 * the tools: one POST, one JSON reply, loopback without a token, off-loopback
 * still refused, and the SSE half refused. What is inside the reply is
 * `tools.test.ts`'s subject — with one
 * exception, and it earns it: a REFUSAL is an envelope claim as much as a
 * payload one, because getting it wrong here means a 500, or a JSON-RPC error
 * frame, or a structured half that never made it into the reply. This is the
 * pipe the chat panel's agent reads its refusals through.
 */

import { DEFAULT_IDENTITY_CONFIG, DEFAULT_IDENTITY_HEADERS } from "@olai/identity"
import {
  codecFor,
  make as makeOps,
  type Store as OutlineStore,
  TOOLS,
} from "@olai/ops"
import { NO_KINDS } from "@olai/format"
import * as Store from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, Option } from "effect"
import * as fs from "node:fs"
import * as http from "node:http"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { listen } from "../listener.ts"
import { SERVER_LAYERS } from "../serve.testlib.ts"
import { hostname } from "../hostname.ts"
import { bind, writerAt } from "../runtime.ts"
import { clientOver, serveFace } from "./face.ts"
import { currentLogin, fromLoopback, MCP_PATH, mcpAllowed, mcpTransport } from "./route.ts"
import { type Ticket, ticketing } from "./tickets.ts"
import { bespokeFrom } from "./tools.ts"

/** The codec this suite validates through — the vocabulary of a build that
 *  composed no plugin, which is what these fixtures declare nothing about
 *  (`@olai/ops`' `codecFor`, and `@olai/format`'s `NO_KINDS`). */
const codec = codecFor(NO_KINDS)

const HOUSE = `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}\n`

const TOKEN = "test-token"

interface Served {
  /** The directory this route is serving — so a case can read back what a call
   *  actually wrote, rather than trusting the answer it was given. */
  readonly root: string
  /** POST one JSON-RPC message, with the token unless told otherwise. */
  readonly post: (
    message: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>
  readonly mintTicket: (under: string) => Ticket
  readonly url: string
}

const withRoute = <A>(
  use: (served: Served) => Promise<A>,
  listenOn: { readonly host: string } = { host: "127.0.0.1" },
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-route-")))
  fs.writeFileSync(path.join(root, "house.olai"), HOUSE)

  return Effect.gen(function*() {
    const store: OutlineStore = yield* Store.make({
      root,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const ops = makeOps({ store, root })
    const wired = yield* bind({
      store,
      ops,
      writer: "mcp",
      hostname: hostname(),
      startedAt: "2026-08-29T09:31:00.000Z",
      // NO PLUGINS. Every runtime in this file is a reader — a bound face, an
      // MCP route — and none of them is about a terminal door or a CI chip;
      // dialing whatever daemons happen to be on the machine running the suite
      // would make these tests depend on them. `null` is the OFF setting, and
      // what it produces is a surface with no `surface/<name>/` on it at all:
      // an empty sibling record composes to no tag, no handler and no expose
      // row, so olai's own group is byte for byte what it always was.
      plugins: null,
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const transport = mcpTransport()
    const panel = clientOver(
      { group: wired.bound.group, handlers: writerAt(wired.bound, ops, { writer: "mcp", fence: null }) },
      wired.faces.agent,
    )
    const tickets = ticketing({ bound: wired.bound, face: wired.faces.agent, ops, token: TOKEN })
    yield* serveFace({
      client: () => panel,
      tools: bespokeFrom(TOOLS, {
        login: currentLogin,
        root,
        vintage: Effect.map(store.read("verified"), (aged) => aged.vintage),
        fenced: tickets.doorAt,
        record: (request) => ops.commit(request, "mcp"),
        push: ops.push,
      }),
      transport,
    })
    yield* Effect.addFinalizer(() => runtime.stopped)

    // olai's REAL listener, so the route is proved where it actually lives —
    // ranked against the shell's catch-all, on the socket a browser shares.
    // `listen` rather than `serve` for one reason: the token is minted inside
    // `serve` and handed only to the session it spawns, so a test that wanted
    // to present a valid one could not get it.
    const base = yield* Effect.orDie(listen({
      bound: wired.bound,
      // A THUNK, as the listener takes it now: a face is derived from the
      // sibling set, so it is read at each accept beside the group it describes
      // rather than once at bind (`../listener.ts`).
      expose: () => wired.faces.browser,
      clientDist: root,
      root,
      hostname: hostname(),
      host: listenOn.host,
      port: 0,
      allowedOrigins: [],
      identity: DEFAULT_IDENTITY_CONFIG,
      mcp: { transport, token: TOKEN, identity: DEFAULT_IDENTITY_CONFIG },
      resync: Effect.void,
    }))

    const url = `${base}${MCP_PATH}`
    return yield* Effect.promise(() =>
      use({
        root,
        url,
        mintTicket: (under) => tickets.mint(
          () => ({ under, forbidden: [] }),
          () => null,
        ),
        post: (message, headers) =>
          fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              authorization: `Bearer ${TOKEN}`,
              ...headers,
            },
            body: JSON.stringify(message),
          }),
      })
    )
  }).pipe(Effect.scoped, Effect.provide(SERVER_LAYERS), Effect.runPromise).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "route.test", version: "0" },
  },
}

test("a POST is answered with JSON, not an SSE stream", async () => {
  await withRoute(async ({ post }) => {
    const response = await post(initialize)

    expect(response.status).toBe(200)
    // THE assertion. `text/event-stream` here is a client hanging on
    // `response.json()`, which is what the e2e chat scenarios saw.
    expect(response.headers.get("content-type")).toContain("application/json")

    const body = await response.json() as { result?: { serverInfo?: { name?: string } } }
    expect(body.result?.serverInfo?.name).toBe("olai")
  })
})

test("a tool call goes through and comes back as one reply", async () => {
  await withRoute(async ({ post }) => {
    await post(initialize)
    // The handshake's third leg. A notification, so the transport answers 202
    // with no body — and the server refuses real work until it has arrived,
    // which is the lifecycle the specification defines and the one every real
    // client follows.
    const ack = await post({ jsonrpc: "2.0", method: "notifications/initialized" })
    expect(ack.status).toBe(202)

    const response = await post({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search_nodes", arguments: { text: "Kitchen" } },
    })

    expect(response.status).toBe(200)
    const body = await response.json() as {
      result?: { structuredContent?: { total?: number } }
    }
    expect(body.result?.structuredContent?.total).toBe(1)
  })
})

test("tools/list and a resource read answer over the same POST", async () => {
  await withRoute(async ({ post }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const listed = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })
    expect(listed.status).toBe(200)
    const tools = (await listed.json() as {
      result?: { tools?: ReadonlyArray<{ name: string }> }
    }).result?.tools ?? []
    expect(tools.map((tool) => tool.name)).toContain("set_done")
    expect(tools.map((tool) => tool.name)).toContain("list_outlines")

    const read = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: { uri: "surface://collections/outlines" },
    })
    expect(read.status).toBe(200)
    expect(JSON.stringify(await read.json())).toContain("house.olai")
  })
})

/**
 * A refusal is an ANSWER on this transport too.
 *
 * `tools.test.ts` pins the contract — `isError` with the structured detail
 * beside the prose — over an `InMemoryTransport`, where a result is handed
 * across in one call. This face is the one transport olai wrote itself: a
 * half-duplex HTTP shape with a waiter table, built because neither of the
 * SDK's Streamable modes fits (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-viewing.md`).
 * It has three ways to get a refusal wrong that an in-memory pair cannot have
 * — an HTTP status keyed off `isError`, a JSON-RPC `error` frame instead of a
 * result, or the structured half dropped in the reply's serialization — and
 * the panel's agent reads its refusals through exactly this pipe.
 */
test("a refused write crosses as a 200 result carrying its structured detail", async () => {
  await withRoute(async ({ post }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const response = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "set_done", arguments: { id: "nowhere" } },
    })

    // 200 and a RESULT: a refused write is something the server answered, not
    // something that went wrong in it.
    expect(response.status).toBe(200)
    const body = await response.json() as {
      error?: unknown
      result?: { isError?: boolean; structuredContent?: Record<string, unknown> }
    }
    expect(body.error).toBeUndefined()
    expect(body.result?.isError).toBe(true)
    expect(body.result?.structuredContent)
      .toMatchObject({ kind: "not-found", named: "nowhere" })
  })
})

test("from loopback the token is optional", async () => {
  await withRoute(async ({ post }) => {
    // No Authorization at all — the `.mcp.json` HTTP client. Loopback is
    // who you are, and that is the whole of the authentication.
    const response = await post(initialize, { authorization: "" })
    expect(response.status).toBe(200)
    const body = await response.json() as { result?: { serverInfo?: { name?: string } } }
    expect(body.result?.serverInfo?.name).toBe("olai")
  })
})

test("from loopback a token is accepted, not required", async () => {
  await withRoute(async ({ post }) => {
    // The chat keeps sending the one it was handed. Harmless either way.
    const response = await post(initialize)
    expect(response.status).toBe(200)
  })
})

test("from loopback a wrong token is still accepted", async () => {
  await withRoute(async ({ post }) => {
    const response = await post(initialize, { authorization: "Bearer wrong" })
    expect(response.status).toBe(200)
  })
})

test("releasing a node ticket closes it without changing arbitrary loopback tokens", async () => {
  await withRoute(async ({ mintTicket, post, root }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const ticket = mintTicket("kitchen")
    const call = (id: number, key: string, bearer: string) =>
      post({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "set_prop", arguments: { id: "kitchen", key, value: "yes" } },
      }, { authorization: `Bearer ${bearer}` })

    const active = await call(20, "active-ticket", ticket.bearer)
    expect((await active.json() as { error?: unknown }).error).toBeUndefined()
    ticket.release()

    const stale = await call(21, "stale-ticket", ticket.bearer)
    const refused = await stale.json() as {
      result?: { isError?: boolean; structuredContent?: { reason?: string } }
    }
    expect(refused.result?.isError).toBe(true)
    expect(refused.result?.structuredContent?.reason).toContain("conversation has been reaped")

    // The old local-client affordance is a different namespace and remains
    // unfenced; recognizing stale node tickets must not redefine it.
    const local = await call(22, "local-token", "arbitrary-local-token")
    expect((await local.json() as { error?: unknown }).error).toBeUndefined()

    const contents = fs.readFileSync(path.join(root, "house.olai"), "utf8")
    expect(contents).toContain("active-ticket")
    expect(contents).not.toContain("stale-ticket")
    expect(contents).toContain("local-token")
  })
})

/**
 * Off loopback the bearer is still the gate.
 *
 * Bound to every interface so a request can arrive from an address that is
 * not 127.0.0.1; fetched at that address so the kernel reports it as the
 * peer. A machine with no non-loopback IPv4 cannot pose the question, and
 * says so rather than passing a test that never ran.
 */
test("off loopback the bearer is still required", async () => {
  const peer = nonLoopbackIPv4()
  if (peer === undefined) {
    throw new Error(
      "off-loopback /mcp auth needs a non-loopback IPv4 to connect from — " +
        "this machine has none",
    )
  }

  await withRoute(async ({ url }) => {
    const port = Number(new URL(url).port)
    // Bind the CLIENT to the non-loopback address. Fetching the LAN IP
    // from the same host often hairpins via 127.0.0.1, which would
    // silently test the wrong thing.
    const response = await postFrom(peer, port, initialize)
    expect(response.status).toBe(401)
    expect(response.body).toBe("unauthorized")
  }, { host: "0.0.0.0" })
})

test("loopback is exactly 127.0.0.1, ::1, and the IPv4-mapped form", () => {
  expect(fromLoopback("127.0.0.1")).toBe(true)
  expect(fromLoopback("::1")).toBe(true)
  expect(fromLoopback("::ffff:127.0.0.1")).toBe(true)
  expect(fromLoopback("10.0.0.4")).toBe(false)
  expect(fromLoopback("192.168.1.10")).toBe(false)
  expect(fromLoopback("8.8.8.8")).toBe(false)
})

test("mcpAllowed skips the bearer only on a known loopback peer", () => {
  const token = "secret"
  expect(mcpAllowed(Option.some("127.0.0.1"), undefined, token)).toBe(true)
  expect(mcpAllowed(Option.some("127.0.0.1"), "Bearer secret", token)).toBe(true)
  expect(mcpAllowed(Option.some("10.0.0.4"), undefined, token)).toBe(false)
  expect(mcpAllowed(Option.some("10.0.0.4"), "Bearer secret", token)).toBe(true)
  expect(mcpAllowed(Option.some("10.0.0.4"), "Bearer wrong", token)).toBe(false)
  // Unknown peer — refuse rather than guess.
  expect(mcpAllowed(Option.none(), undefined, token)).toBe(false)
})

/** First non-internal IPv4, if this machine has one. */
const nonLoopbackIPv4 = (): string | undefined => {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address
    }
  }
  return undefined
}

/** POST /mcp from a specific local address, so the kernel reports that peer. */
const postFrom = (
  localAddress: string,
  port: number,
  message: unknown,
): Promise<{ readonly status: number; readonly body: string }> =>
  new Promise((resolve, reject) => {
    const req = http.request({
      host: localAddress,
      port,
      path: MCP_PATH,
      method: "POST",
      localAddress,
      headers: { "content-type": "application/json", accept: "application/json" },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        }))
    })
    req.on("error", reject)
    req.end(JSON.stringify(message))
  })

test("the SSE half is refused, because this face pushes nothing", async () => {
  await withRoute(async ({ url }) => {
    const response = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(response.status).toBe(405)
  })
})

/**
 * Garbage in, an ANSWER out — not silence.
 *
 * A body that parses as JSON but is not a message (`null`, `42`, `[]`) reaches
 * the SDK's `Protocol` as something it reports to `onerror` and never replies
 * to. Through a half-duplex transport that is indistinguishable from a
 * notification: 202, no frame, and a client that expected one waits forever.
 * The hand-rolled dispatch this replaced judged the shape itself and answered
 * `-32600`, so the judgement stays at the edge where it always was.
 *
 * Not the chat path — no real client sends these — which is exactly why it is
 * worth a test: nothing else would ever notice it break.
 */
test("a body that is not a JSON-RPC message is refused, not silently accepted", async () => {
  await withRoute(async ({ post }) => {
    for (const garbage of [null, 42, [], "a string"]) {
      const response = await post(garbage)
      expect(response.status).toBe(400)
      const body = await response.json() as { error?: { code?: number } }
      expect(body.error?.code).toBe(-32600)
    }
  })
})


/**
 * The waiter table, driven directly.
 *
 * Through HTTP this would be a race: `search_nodes` answers in microseconds, so
 * two POSTs sharing an id would almost never actually overlap and the test
 * would pass without exercising anything. Driving the transport with an
 * `onmessage` that never answers makes the collision certain.
 *
 * What it guards: the second `ask` used to `set` over the first's resolver,
 * which dropped it on the floor — that POST then hung until the process died.
 * A client reusing an id is a client bug; a request that never comes back was
 * ours.
 */
test("an id already in flight is answered rather than overwriting its waiter", async () => {
  const transport = mcpTransport()
  // Nothing answers, so the first request stays in flight for the whole test.
  transport.onmessage = () => {}

  const first = transport.ask({ jsonrpc: "2.0", id: 7, method: "tools/list" })
  const second = await transport.ask({ jsonrpc: "2.0", id: 7, method: "tools/list" }) as {
    id?: number
    error?: { code?: number }
  }

  expect(second.id).toBe(7)
  expect(second.error?.code).toBe(-32600)

  // And the FIRST is still waiting for its real answer rather than having been
  // resolved or forgotten — which is the half that used to break.
  let settled = false
  void first.then(() => {
    settled = true
  })
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(settled).toBe(false)

  // Closed rather than left pending: `close` answers its waiters so a shutdown
  // cannot strand one.
  await transport.close()
  expect(await first).toBeNull()
})

/**
 * WHO A WRITE IS ATTRIBUTED TO IS A FACT ABOUT THE REQUEST, not about the face.
 *
 * The face behind this route is built once, at boot, with one transport and one
 * set of handlers. The login is not: a reverse proxy injects it per request, and
 * two people can be behind one proxy. So it travels beside the request in an
 * `AsyncLocalStorage` (`./route.ts`'s `WHOSE`) rather than bound into the face
 * — and the reason it is that and not a field is exactly what the second case
 * below measures. A field would be a race whose failure mode is a capture
 * attributed to the wrong person, silently, and permanently, in a file.
 */
test("a capture is recorded as the login the proxy named on THAT request", async () => {
  await withRoute(async ({ post, root }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    await post(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "capture", arguments: { title: "from the tailnet" } },
      },
      { "Tailscale-User-Login": "srid@github" },
    )
    // …and one with no proxy in front of it at all, which is what a direct
    // loopback call is. The ruling: a door that knows nobody writes NO
    // attribution rather than a made-up one.
    await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "capture", arguments: { title: "from nobody" } },
    })

    const inbox = fs.readFileSync(path.join(root, "_olai", "Inbox.olai"), "utf8")
    const rows = inbox.trim().split("\n").map((line) => JSON.parse(line) as {
      title?: string
      custom?: Record<string, string>
    })
    expect(rows.find((row) => row.title === "from the tailnet")?.custom).toEqual({
      "captured-by": "srid@github",
    })
    expect(rows.find((row) => row.title === "from nobody")?.custom).toBeUndefined()
  })
})

test("…and two people behind one proxy do not get each other's", async () => {
  // Two calls in flight at once, through one face, one transport and one set of
  // handlers — because two people behind one proxy is the ordinary case for the
  // deployment this door is reached through, and a capture attributed to the
  // wrong person is not a crash, not a refusal, and not discoverable
  // afterwards: it is a file that quietly says the wrong thing.
  //
  // WHAT THIS DOES NOT PROVE, said out loud because it was measured: it does not
  // demonstrate that the `AsyncLocalStorage` is load-bearing. Swapping it for a
  // plain module-level field leaves this case green, because the login is read
  // SYNCHRONOUSLY at the top of the handler (`../mcp/tools.ts`), on the
  // request's own stack, before anything can yield to the other request — and
  // that is what actually makes it right. The storage is the structural half of
  // the same guarantee: it survives a handler that starts reading it later,
  // which a field would not, and it is what makes "read it later" a safe thing
  // for the next person to write rather than a trap.
  await withRoute(async ({ post, root }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const capture = (id: number, title: string, login: string) =>
      post(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: "capture", arguments: { title } },
        },
        { "Tailscale-User-Login": login },
      )

    await Promise.all([
      capture(10, "ada's line", "ada@example.com"),
      capture(11, "grace's line", "grace@example.com"),
    ])

    const inbox = fs.readFileSync(path.join(root, "_olai", "Inbox.olai"), "utf8")
    const rows = inbox.trim().split("\n").map((line) => JSON.parse(line) as {
      title?: string
      custom?: Record<string, string>
    })
    expect(rows.find((row) => row.title === "ada's line")?.custom).toEqual({
      "captured-by": "ada@example.com",
    })
    expect(rows.find((row) => row.title === "grace's line")?.custom).toEqual({
      "captured-by": "grace@example.com",
    })
  })
})
