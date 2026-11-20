import { writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { SURFACE_WS_PATH } from "@kolu/surface-app"
import { surface } from "@olai/surface"
import { findSaid } from "@olai/log/testlib"
import { Effect } from "effect"
import { WebSocket as WsClient } from "ws"
import { served, withServe, withServing } from "./serve.testlib.ts"
import { startWeb } from "./child.testlib.ts"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

for (const profile of ["web", "surface"] as const) {
  test(`an MCP client can discover and call tools in the ${profile} profile`, async () => {
    const root = served()
    writeFileSync(join(root, "a.olai"), `${JSON.stringify({ id: "a", ord: "a0", title: "Discovered through MCP" })}\n`)
    await withServing({ root, profile }, async (url) => {
      const client = new Client({ name: "mcp-startup-regression", version: "1" })
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`)))
        const { tools } = await client.listTools()
        expect(tools.map(tool => tool.name)).toContain("outlines_read")
        const read = await client.callTool({ name: "outlines_read", arguments: { id: "a" } })
        expect(read.isError).not.toBe(true)
        expect(JSON.stringify(read)).toContain("Discovered through MCP")
      } finally {
        await client.close()
      }
    })
  }, 30_000)
}

const request = (url: string, method = "tools/list", params?: unknown) => fetch(`${url}/mcp`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  signal: AbortSignal.timeout(5000),
})

const flip = async (url: string, name: string, enabled: boolean) => {
  const socket = await createSurfaceSocket({
    group: surface.group,
    url: `${url.replace("http://", "ws://")}${SURFACE_WS_PATH}`,
    retired: () => {},
    connect: (target) => new WsClient(target) as unknown as WebSocket,
  })
  try {
    await Effect.runPromise(socket.link.dispatch.unary("surface/plugins/set", { name, enabled }) as Effect.Effect<unknown>)
  } finally {
    await socket.dispose()
  }
}

test("the surface profile serves MCP reads and writes without browser routes or websocket", async () => {
  await withServing({ root: served(), profile: "surface" }, async (url) => {
    const response = await request(url)
    expect(response.status).toBe(200)
    const tools = (await response.json()).result.tools.map((tool: { name: string }) => tool.name)
    expect(tools).toContain("outlines_read")
    expect(tools).toContain("outlines_title")
    const wrote = await request(url, "tools/call", { name: "outlines_title", arguments: { id: "a", title: "Changed over MCP" } })
    expect((await wrote.json()).result.isError).not.toBe(true)
    const read = await request(url, "tools/call", { name: "outlines_read", arguments: { id: "a" } })
    expect(JSON.stringify(await read.json())).toContain("Changed over MCP")
    for (const route of ["/", "/manifest.webmanifest", "/media/a", "/olai/who", SURFACE_WS_PATH]) {
      expect((await fetch(url + route)).status).toBe(404)
    }
    const status = await new Promise<number>((resolve, reject) => {
      const ws = new WsClient(url.replace("http://", "ws://") + SURFACE_WS_PATH)
      ws.on("unexpected-response", (_req, res) => { res.resume(); resolve(res.statusCode ?? 0); ws.terminate() })
      ws.on("open", () => { ws.close(); reject(new Error("MCP profile accepted a websocket")) })
      ws.on("error", () => {})
    })
    expect(status).toBe(404)
  })
})

test("MCP can be disabled and re-enabled twice without losing the browser control socket", async () => {
  await withServing({ root: served(), plugins: ["vault", "ws", "mcp", "web-app"] }, async (url) => {
    for (let i = 0; i < 2; i++) {
      expect((await request(url)).status).toBe(200)
      await flip(url, "mcp", false)
      expect((await request(url)).status).toBe(404)
      expect((await fetch(url + "/mcp")).status).toBe(404)
      expect((await fetch(url + "/olai/who")).status).toBe(204)
      await flip(url, "mcp", true)
      expect((await request(url)).status).toBe(200)
    }
  })
})

test("the empty transport profile opens the vault and announces that it has no listener", async () => {
  await withServe({ root: served(), profile: "test-minimal" }, async (said) => {
    expect(findSaid(said, "no transport rows enabled")).toBeDefined()
    expect(findSaid(said, "serving")).toBeUndefined()
  })
})

test("the surface profile CLI boots without a browser build and releases its port on stop", async () => {
  const child = startWeb({ root: served(), extra: ["--profile", "surface"], env: { OLAI_DIST_DIR: "/no-browser-build" } })
  let url = ""
  try {
    url = await child.address()
    expect((await request(url)).status).toBe(200)
    expect((await fetch(url)).status).toBe(404)
  } finally {
    expect(await child.stop()).toBe(130)
  }
  await expect(fetch(url)).rejects.toThrow()
}, 15000)

test("an MCP-only profile falls back when its requested port is busy", async () => {
  const first = startWeb({ root: served(), extra: ["--profile", "surface"] })
  let second: ReturnType<typeof startWeb> | undefined
  try {
    const firstUrl = await first.address()
    second = startWeb({ root: served(), extra: ["--profile", "surface", "--port", new URL(firstUrl).port] })
    const secondUrl = await second.address()
    expect(secondUrl).not.toBe(firstUrl)
    expect(second.said()).toContain("port in use")
    expect((await request(firstUrl)).status).toBe(200)
    expect((await request(secondUrl)).status).toBe(200)
  } finally {
    if (second) await second.stop()
    await first.stop()
  }
}, 15000)

test("switching ws off through its own socket leaves MCP serving on the same port", async () => {
  await withServing({ root: served(), plugins: ["vault", "ws", "mcp", "web-app"] }, async (url) => {
    await flip(url, "ws", false).catch(() => {})
    expect((await request(url)).status).toBe(200)
    expect((await fetch(url + "/olai/who")).status).toBe(404)
  })
}, 10000)

test("vault withdrawal removes content tools and resync, then a new activation reads disk", async () => {
  await withServing({ root: served(), plugins: ["vault", "outlines", "ws", "mcp", "web-app"] }, async (url) => {
    for (let i = 0; i < 2; i++) {
      await flip(url, "vault", false)
      const listed = await request(url)
      const tools = (await listed.json()).result.tools.map((tool: { name: string }) => tool.name)
      expect(tools).not.toContain("outlines_title")
      expect(tools).not.toContain("outlines_read")
      expect((await (await request(url, "resources/list")).json()).result.resources).toEqual([])
      expect((await (await request(url, "resources/templates/list")).json()).result.resourceTemplates).toEqual([])
      const rejected = await request(url, "tools/call", { name: "outlines_title", arguments: { id: "a", title: "must not land" } })
      const refused = (await rejected.json()).result
      expect(refused.isError).toBe(true)
      expect(JSON.stringify(refused)).toContain("is no longer served")
      expect(JSON.stringify(refused)).toContain("outlines")
      expect((await fetch(url + "/olai/resync", { method: "POST" })).status).toBe(404)
      await flip(url, "vault", true)
      const wrote = await request(url, "tools/call", { name: "outlines_title", arguments: { id: "a", title: `activation ${i}` } })
      expect((await wrote.json()).result.isError).not.toBe(true)
      const read = await request(url, "tools/call", { name: "outlines_read", arguments: { id: "a" } })
      expect(JSON.stringify(await read.json())).toContain(`activation ${i}`)
    }
  })
})

test("selected content rows lose their tools while the vault is stopped and regain them on return", async () => {
  const root = served()
  await withServing({ root, plugins: ["outlines", "ws", "mcp", "web-app"] }, async (url) => {
    await flip(url, "vault", false)
    const listed = await request(url)
    expect((await listed.json()).result.tools.map((tool: { name: string }) => tool.name)).not.toContain("outlines_read")
    expect((await fetch(url + "/olai/resync", { method: "POST" })).status).toBe(404)
    await flip(url, "vault", true)
    const read = await request(url, "tools/call", { name: "outlines_read", arguments: { id: "a" } })
    expect((await read.json()).result.isError).not.toBe(true)
  })
})

test("an exact empty selection overrides every profile and opens no listener", async () => {
  for (const profile of ["web", "surface", "test-minimal"] as const) {
    await withServe({ root: served(), profile, plugins: [] }, async (said) => {
      expect(findSaid(said, "no transport rows enabled")).toBeDefined()
      expect(findSaid(said, "serving")).toBeUndefined()
    })
  }
})

test("an exact MCP selection can override the profile's transports", async () => {
  await withServing({ root: served(), profile: "test-minimal", plugins: ["vault", "mcp"] }, async (url) => {
    expect((await request(url)).status).toBe(200)
    expect((await fetch(url + "/olai/who")).status).toBe(404)
  })
})


test("an exact MCP CLI selection does not require a browser build in web profile", async () => {
  for (let cycle = 0; cycle < 3; cycle += 1) {
  const child = startWeb({ root: served(), policy: {"only": "vault,mcp"}, extra: [], env: { OLAI_DIST_DIR: "/no-browser-build" } })
  try {
    const url = await child.address()
    expect((await request(url)).status).toBe(200)
    expect((await fetch(url)).status).toBe(404)
  } finally {
    const code = await child.stop()
    expect(code, `MCP-only shutdown cycle ${cycle}: ${child.said()}`).toBe(130)
  }
  }
}, 15000)

test("an exact asset-only selection serves its build without websocket admission or MCP", async () => {
  const build = served()
  writeFileSync(join(build, "index.html"), "<!doctype html><p>standalone build</p>")
  try {
    await withServing({ root: served(), clientDist: build, plugins: ["web-app"] }, async (url) => {
      expect((await fetch(url)).status).toBe(200)
      expect((await request(url)).status).toBe(404)
      const status = await new Promise<number>((resolve, reject) => {
        const socket = new WsClient(url.replace("http://", "ws://") + SURFACE_WS_PATH)
        socket.on("unexpected-response", (_req, response) => { response.resume(); resolve(response.statusCode ?? 0); socket.terminate() })
        socket.on("open", () => { socket.close(); reject(new Error("asset-only selection admitted a socket")) })
        socket.on("error", () => {})
      })
      expect(status).toBe(404)
    })
  } finally { rmSync(build, { recursive: true, force: true }) }
})

test("CLI content removal applies over the headless profile without requiring a browser build", async () => {
  const child = startWeb({ root: served(), policy: {"without": "outlines"}, extra: ["--profile", "surface"], env: { OLAI_DIST_DIR: "/no-browser-build" } })
  try {
    const url = await child.address()
    const listed = await request(url)
    const tools = (await listed.json()).result.tools.map((tool: { name: string }) => tool.name)
    expect(tools).toContain("markdown_read")
    expect(tools).not.toContain("outlines_read")
    expect((await fetch(url)).status).toBe(404)
  } finally { expect(await child.stop()).toBe(130) }
}, 15000)

test("a non-notebook MCP host remains available after its vault is stopped", async () => {
  const child = startWeb({ root: served(), policy: {"only": "mcp,ws,test-counter"}, extra: ["--profile", "surface"], env: { OLAI_DIST_DIR: "/no-browser-build" } })
  try {
    const url = await child.address()
    await flip(url, "vault", false)
    const listed = await request(url)
    const tools = (await listed.json()).result.tools.map((tool: { name: string }) => tool.name)
    expect(tools).toEqual([])
    expect(tools).not.toContain("outlines_read")
    expect(tools).not.toContain("markdown_read")
    expect((await fetch(url + "/olai/resync", { method: "POST" })).status).toBe(404)
    expect((await fetch(url)).status).toBe(404)
  } finally { expect(await child.stop()).toBe(130) }
}, 15000)

test("the plugin author's three verbs leave with the row that owns them", async () => {
  await withServing({ root: served(), plugins: ["vault", "vault-plugins", "ws", "mcp"] }, async url => {
    const names = async () => (await (await request(url)).json()).result.tools.map((tool: { name: string }) => tool.name) as string[]
    expect(await names()).toContain("vault-plugins_inspect")
    expect(await names()).toContain("vault-plugins_run")
    expect(await names()).toContain("vault-plugins_stop")
    await flip(url, "vault-plugins", false)
    expect(await names()).not.toContain("vault-plugins_inspect")
    expect(await names()).not.toContain("vault-plugins_run")
    expect(await names()).not.toContain("vault-plugins_stop")
    const refused = await request(url, "tools/call", { name: "vault-plugins_inspect", arguments: {} })
    const said = (await refused.json()).result
    expect(said.isError).toBe(true)
    expect(JSON.stringify(said)).toContain("no longer served")
    expect(JSON.stringify(said)).toContain("vault-plugins")
    await flip(url, "vault-plugins", true)
    expect(await names()).toContain("vault-plugins_inspect")
    const answered = await request(url, "tools/call", { name: "vault-plugins_inspect", arguments: {} })
    expect((await answered.json()).result.isError).not.toBe(true)
  })
})

test("shared write tags retain only their active content cases on the MCP catalog", async () => {
  await withServing({ root: served(), plugins: ["vault", "outlines", "markdown", "files", "capture", "ws", "mcp"] }, async url => {
    const names = async () => (await (await request(url)).json()).result.tools.map((tool: { name: string }) => tool.name) as string[]
    expect(await names()).toContain("capture_add")
    await flip(url, "capture", false)
    expect(await names()).not.toContain("capture_add")
    expect(await names()).toContain("outlines_title")
    await flip(url, "outlines", false)
    expect(await names()).not.toContain("outlines_title")
    expect(await names()).not.toContain("outlines_read")
    expect(await names()).toContain("markdown_write")
    const created = await request(url, "tools/call", { name: "markdown_create", arguments: { file: "independent.md", text: "# Independent" } })
    expect((await created.json()).result.isError).not.toBe(true)
    await flip(url, "outlines", true)
    expect(await names()).toContain("outlines_title")
    const wrote = await request(url, "tools/call", { name: "outlines_title", arguments: { id: "a", title: "Returned" } })
    expect((await wrote.json()).result.isError).not.toBe(true)
    await flip(url, "capture", true)
    expect(await names()).toContain("capture_add")
  })
})


test("mail advertises exactly eleven tools while running and withdraws them on every stop", async () => {
  await withServing({ root: served(), plugins: ["vault", "ws", "mcp", "web-app", "chat", "mail"] }, async url => {
    const names = async () => {
      const response = await request(url)
      const body = await response.json()
      return body.result.tools.map((tool: { name: string }) => tool.name).filter((name: string) => name.startsWith("mail_")).sort()
    }
    const expected = ["archive", "attachment", "draft", "draft_update", "inbox", "label", "read", "search", "thread", "trash", "untrash"].map(n => `mail_${n}`)
    for (let round = 0; round < 2; round++) {
      expect(await names()).toEqual(expected)
      await flip(url, "mail", false)
      expect(await names()).toEqual([])
      await flip(url, "mail", true)
    }
    expect(await names()).toEqual(expected)
  })
}, 30_000)

const initialize = async (url: string): Promise<string> => {
  const response = await request(url, "initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "profiles.test", version: "0" },
  })
  expect(response.status).toBe(200)
  return (await response.json()).result.instructions as string
}

const BESIDE = "A person reads your answer in olai, beside the note or the outline this chat is about"

test("the chat panel's sentence to an agent is on the wire exactly while chat is standing", async () => {
  await withServing({ root: served(), profile: "web", policy: { without: "chat" } }, async url => {
    const said = await initialize(url)
    expect(said).toContain("NODES and whole FILES")
    expect(said).toContain("`/#<id>` names a node")
    expect(said).not.toContain(BESIDE)
  })
  await withServing({ root: served(), profile: "web" }, async url => {
    const said = await initialize(url)
    expect(said).toContain("NODES and whole FILES")
    expect(said).toContain(BESIDE)
    expect(Buffer.byteLength(said, "utf8")).toBeLessThan(2000)
  })
}, 30_000)
