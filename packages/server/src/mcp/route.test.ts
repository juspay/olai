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
 * refused. What is inside the reply is `tools.test.ts`'s subject.
 */

import { codec, make as makeOps, TOOLS } from "@olai/ops"
import { type OutlineError, type OutlineSet } from "@olai/format"
import * as Store from "@olai/store"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { listen } from "../listener.ts"
import { SERVER_LAYERS } from "../serve.testlib.ts"
import { bind } from "../runtime.ts"
import { serveFace } from "./face.ts"
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
    const ops = makeOps({ store, root, commit: false })
    const wired = yield* bind({ store, chat: null })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const transport = mcpTransport()
    yield* serveFace({
      bound: wired.bound,
      tools: bespokeFrom(TOOLS, ops),
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
