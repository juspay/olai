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
 * the tools: one POST, one JSON reply, the token enforced, and the SSE half
 * refused. What is inside the reply is `tools.test.ts`'s subject — with one
 * exception, and it earns it: a REFUSAL is an envelope claim as much as a
 * payload one, because getting it wrong here means a 500, or a JSON-RPC error
 * frame, or a structured half that never made it into the reply. This is the
 * pipe the chat panel's agent reads its refusals through.
 */

import { codec, make as makeOps, TOOLS } from "@olai/ops"
import { type OutlineError, type OutlineSet } from "@olai/format"
import * as Store from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { listen } from "../listener.ts"
import { SERVER_LAYERS } from "../serve.testlib.ts"
import { bind, gitWiring } from "../runtime.ts"
import { clientOver, serveFace } from "./face.ts"
import { MCP_PATH, mcpTransport } from "./route.ts"
import { bespokeFrom } from "./tools.ts"

const HOUSE = `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}\n`

const TOKEN = "test-token"

interface Served {
  /** POST one JSON-RPC message, with the token unless told otherwise. */
  readonly post: (
    message: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>
  readonly url: string
}

const withRoute = <A>(use: (served: Served) => Promise<A>): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-route-")))
  fs.writeFileSync(path.join(root, "house.jsonl"), HOUSE)

  return Effect.gen(function*() {
    const store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>> = yield* Store.make({
      root,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const ops = makeOps({ store, root, commits: "off" })
    const wired = yield* bind({
      store,
      chat: null,
      ops,
      writer: "mcp",
      git: gitWiring(ops, "mcp", yield* SubscriptionRef.make(0)),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const transport = mcpTransport()
    yield* serveFace({
      client: () => clientOver(wired.bound.handlers),
      tools: bespokeFrom(TOOLS, "mcp"),
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
      clientDist: root,
      root,
      host: "127.0.0.1",
      port: 0,
      allowedOrigins: [],
      mcp: { transport, token: TOKEN },
    }))

    const url = `${base}${MCP_PATH}`
    return yield* Effect.promise(() =>
      use({
        url,
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

/**
 * A refusal is an ANSWER on this transport too.
 *
 * `tools.test.ts` pins the contract — `isError` with the structured detail
 * beside the prose — over an `InMemoryTransport`, where a result is handed
 * across in one call. This face is the one transport olai wrote itself: a
 * half-duplex HTTP shape with a waiter table, built because neither of the
 * SDK's Streamable modes fits (`docs/brainstorming/surface-mcp-viewing.md`).
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

test("without the token nothing is reachable", async () => {
  await withRoute(async ({ post }) => {
    const response = await post(initialize, { authorization: "Bearer wrong" })
    expect(response.status).toBe(401)
    // The refusal is the ROUTE's, so it never reached the transport and says so
    // in plain text rather than as a JSON-RPC frame.
    expect(await response.text()).toBe("unauthorized")
  })
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
