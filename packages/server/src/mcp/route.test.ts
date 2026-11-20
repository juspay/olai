import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { capabilitiesOver } from "../capabilities.testlib.ts"
import { WRITE_RESERVATIONS } from "@olai/bundle/policy"
import {
  codecFor,
  make as makeOps,
  type Store as OutlineStore,
  type Tool,
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
import type { Reading } from "../who.ts"
import { listen } from "../listener.ts"
import { SERVER_LAYERS } from "../serve.testlib.ts"
import { hostname } from "../hostname.ts"
import { bind } from "../runtime.ts"
import type { RootedSurfaceClients } from "@kolu/surface/client"
import {
  bespokeFrom,
  clientsFor,
  currentLogin,
  currentTicket,
  fromLoopback,
  MCP_PATH,
  mcpAllowed,
  mcpRoute,
  mcpTransport,
  serveFace,
  siblingsOf,
  ticketing,
  type Row,
  type Ticket,
} from "olai-plugin-mcp/testlib"

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

const HOUSE = `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}\n`

const TOKEN = "test-token"

const LOGIN = "tailscale-user-login"

const PROXY: Reading = (headers) => {
  const raw = headers[LOGIN]
  const login = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ""
  return login === "" ? null : { login, name: null, picture: null }
}

interface Served {
  readonly root: string
  readonly post: (
    message: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>
  readonly retainedTicket: () => { ticket: Ticket; client: RootedSurfaceClients }
  readonly mintTicket: () => Ticket
  readonly url: string
}

const withRoute = <A>(
  use: (served: Served) => Promise<A>,
  listenOn: { readonly host: string; readonly definitions?: boolean } = { host: "127.0.0.1" },
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
    const ops = makeOps({claims: { current: TEST_CLAIMS }, format: "outline-olai",  store, root })
    const wired = yield* bind({
      hostname: hostname(),
      startedAt: "2026-08-29T09:31:00.000Z",
      plugins: yield* capabilitiesOver(store, ops, root, {definitions:listenOn.definitions ?? true}),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => runtime.close)

    const transport = mcpTransport()
    const rows = (): ReadonlyArray<Row> => wired.bound.agentRows()
    const panel = () => clientsFor(
      rows(),
      () => ({ group: wired.bound.group, handlers: wired.bound.handlers, writes: wired.bound.writes, expose: wired.faces.agent }),
      { writer: "mcp" },
    )
    let selectingTicket: string | null = null
    const tickets = ticketing({ reservations: WRITE_RESERVATIONS, bound: wired.bound, face: wired.faces.agent, ops, token: TOKEN, currentTicket: () => selectingTicket ?? currentTicket(), rows })
    yield* serveFace({
      siblings: siblingsOf(rows(), row => bespokeFrom(row.name, row.tools as ReadonlyArray<Tool>, rows, {
        login: currentLogin,
        root,
        vintage: Effect.map(store.read("verified"), (aged) => aged.vintage),
        doorAt: () => tickets.doorAt(panel()),
        record: (request) => ops.commit(request, "mcp"),
        push: ops.push,
      })),
      client: panel,
      rows,
      transport,
    })

    const base = yield* listen({
      host: listenOn.host, port: 0,
      contributions: [{ routes: mcpRoute({ transport, token: TOKEN, who: PROXY }) }],
    })

    const url = `${base}${MCP_PATH}`
    return yield* Effect.promise(() =>
      use({
        root,
        url,
        retainedTicket: () => {
          const ticket = tickets.mint(() => [], "chat-agent")
          selectingTicket = ticket.bearer
          try { return { ticket, client: tickets.doorAt(panel()) } }
          finally { selectingTicket = null }
        },
        mintTicket: () => tickets.mint(
          () => [],
          "chat-agent",
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
    expect(response.headers.get("content-type")).toContain("application/json")

    const body = await response.json() as { result?: { serverInfo?: { name?: string } } }
    expect(body.result?.serverInfo?.name).toBe("olai")
  })
})

test("a tool call goes through and comes back as one reply", async () => {
  await withRoute(async ({ post }) => {
    await post(initialize)
    const ack = await post({ jsonrpc: "2.0", method: "notifications/initialized" })
    expect(ack.status).toBe(202)

    const response = await post({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "outlines_read", arguments: { id: "kitchen" } },
    })

    expect(response.status).toBe(200)
    const body = await response.json() as {
      result?: { structuredContent?: { title?: string } }
    }
    expect(body.result?.structuredContent?.title).toBe("Kitchen remodel")
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
    expect(tools.map((tool) => tool.name)).toContain("outlines_done")
    expect(tools.map((tool) => tool.name)).toContain("outlines_index")
    expect(tools.map((tool) => tool.name)).not.toContain("plugins_configure")
    const configure = await post({ jsonrpc: "2.0", id: 99, method: "tools/call", params: { name: "plugins_configure", arguments: { name: "git", key: "commit", value: "auto" } } })
    const refused = await configure.json() as { error?: unknown; result?: { isError?: boolean } }
    expect(refused.error !== undefined || refused.result?.isError === true).toBe(true)

    const read = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: { uri: "surface://collections/outlines/outlines" },
    })
    expect(read.status).toBe(200)
    expect(JSON.stringify(await read.json())).toContain("house.olai")
  })
})

test("a refused write crosses as a 200 result carrying its structured detail", async () => {
  await withRoute(async ({ post }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const response = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "outlines_done", arguments: { id: "nowhere" } },
    })

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
    const response = await post(initialize, { authorization: "" })
    expect(response.status).toBe(200)
    const body = await response.json() as { result?: { serverInfo?: { name?: string } } }
    expect(body.result?.serverInfo?.name).toBe("olai")
  })
})

test("from loopback a token is accepted, not required", async () => {
  await withRoute(async ({ post }) => {
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

    const ticket = mintTicket()
    const call = (id: number, key: string, bearer: string) =>
      post({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "outlines_prop", arguments: { id: "kitchen", key, value: "yes" } },
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

    const local = await call(22, "local-token", "arbitrary-local-token")
    expect((await local.json() as { error?: unknown }).error).toBeUndefined()

    const contents = fs.readFileSync(path.join(root, "house.olai"), "utf8")
    expect(contents).toContain("active-ticket")
    expect(contents).not.toContain("stale-ticket")
    expect(contents).toContain("local-token")
  })
})

test("a node ticket can list and call the three plugin verbs", async () => {
  await withRoute(async ({ mintTicket, post }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const ticket = mintTicket()
    const bearer = { authorization: `Bearer ${ticket.bearer}` }

    const listed = await (await post({ jsonrpc: "2.0", id: 40, method: "tools/list" }, bearer))
      .json() as { result?: { tools?: ReadonlyArray<{ name: string }> } }
    const names = (listed.result?.tools ?? []).map((one) => one.name)
    expect(names).toContain("vault-plugins_guide")
    expect(names).toContain("vault-plugins_inspect")
    expect(names).toContain("vault-plugins_write")
    expect(names).toContain("vault-plugins_run")
    expect(names).toContain("vault-plugins_stop")

    const inspected = await (await post({
      jsonrpc: "2.0",
      id: 41,
      method: "tools/call",
      params: { name: "vault-plugins_inspect", arguments: {} },
    }, bearer)).json() as { result?: { structuredContent?: Record<string, unknown> } }
    const said = inspected.result?.structuredContent
    expect(said?.modules).toEqual(["@olai/plugin-api", "effect", "solid-js"])
    expect(said?.services).toContainEqual({ key: "kinds", half: "server", availability: "core" })
    expect((said?.slots as ReadonlyArray<{ name: string }>).map((one) => one.name))
      .toContain("outline.row.chip")
    expect(said?.layout).toEqual({
      folder: "plugins/",
      readme: "README.md",
      server: "server.ts",
      browser: "browser.tsx",
      settings: {
        file: "_olai/Settings.olai",
        schema: "Config",
        properties: "a node titled after the plugin's word in _olai/Settings.olai; its properties are the Config leaves and child nodes hold schema sections",
        reserved: ["approved", "on", "checked"],
      },
    })

    const guided = await (await post({
      jsonrpc: "2.0",
      id: 43,
      method: "tools/call",
      params: { name: "vault-plugins_guide", arguments: {} },
    }, bearer)).json() as { result?: { structuredContent?: { text?: string; folder?: string } } }
    expect(guided.result?.structuredContent?.folder).toBe("plugins/")
    expect(guided.result?.structuredContent?.text ?? "").toContain("@olai/plugin-api")

    const ran = await (await post({
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      params: { name: "vault-plugins_run", arguments: { name: "swatch" } },
    }, bearer)).json() as {
      result?: { isError?: boolean; structuredContent?: { reason?: string } }
    }
    expect(ran.result?.isError).toBe(true)
    expect(ran.result?.structuredContent?.reason).toContain("defines no plugin")
    expect(ran.result?.structuredContent?.reason).toContain("server.ts")
  })
})

for (const definitions of [true, false]) test(`a node ticket cannot write approval with vault policy ${definitions ? "present" : "absent"}`, async () => {
  await withRoute(async ({ mintTicket, post, root }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const ticket = mintTicket()
    const call = (id: number, key: string) =>
      post({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "outlines_prop", arguments: { id: "kitchen", key, value: "always" } },
      }, { authorization: `Bearer ${ticket.bearer}` })

    const ordinary = await call(30, "some-other-key")
    expect((await ordinary.json() as { error?: unknown }).error).toBeUndefined()

    const approval = await call(31, "approved")
    const refused = await approval.json() as {
      result?: { isError?: boolean; structuredContent?: { reason?: string } }
    }
    expect(refused.result?.isError).toBe(true)
    expect(refused.result?.structuredContent?.reason).toContain("may not write")
    expect(refused.result?.structuredContent?.reason).toContain("the plugin's own page")

    const contents = fs.readFileSync(path.join(root, "house.olai"), "utf8")
    expect(contents).toContain("some-other-key")
    expect(contents).not.toContain("approved")
  }, {host:"127.0.0.1", definitions})
})

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
  expect(mcpAllowed(Option.none(), undefined, token)).toBe(false)
})

const nonLoopbackIPv4 = (): string | undefined => {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address
    }
  }
  return undefined
}

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


test("an id already in flight is answered rather than overwriting its waiter", async () => {
  const transport = mcpTransport()
  transport.onmessage = () => {}

  const first = transport.ask({ jsonrpc: "2.0", id: 7, method: "tools/list" })
  const second = await transport.ask({ jsonrpc: "2.0", id: 7, method: "tools/list" }) as {
    id?: number
    error?: { code?: number }
  }

  expect(second.id).toBe(7)
  expect(second.error?.code).toBe(-32600)

  let settled = false
  void first.then(() => {
    settled = true
  })
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(settled).toBe(false)

  await transport.close()
  expect(await first).toBeNull()
})

test("a capture is recorded as the login the proxy named on THAT request", async () => {
  await withRoute(async ({ post, root }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    await post(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "capture_add", arguments: { title: "from the tailnet" } },
      },
      { "Tailscale-User-Login": "srid@github" },
    )
    await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "capture_add", arguments: { title: "from nobody" } },
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
  await withRoute(async ({ post, root }) => {
    await post(initialize)
    await post({ jsonrpc: "2.0", method: "notifications/initialized" })

    const capture = (id: number, title: string, login: string) =>
      post(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: "capture_add", arguments: { title } },
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


test("releasing a ticket closes a retained client and the delayed next step of a tool", async () => {
  await withRoute(async ({ retainedTicket, root }) => {
    const { ticket, client } = retainedTicket()
    const run = (title: string) =>
      client.clients!["outlines"]!.surface.ops!.run!({ op: "title", id: "kitchen", title })
    await Effect.runPromise(run("accepted before release"))
    const next = run("forbidden delayed write")
    ticket.release()
    ticket.release()
    await expect(Effect.runPromise(next)).rejects.toThrow("conversation has been reaped")
    await expect(Effect.runPromise(run("forbidden retained write"))).rejects.toThrow("conversation has been reaped")
    const contents = fs.readFileSync(path.join(root, "house.olai"), "utf8")
    expect(contents).toContain("accepted before release")
    expect(contents).not.toContain("forbidden")
  })
})
