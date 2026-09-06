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
    expect(tools).toContain("read_node")
    expect(tools).toContain("set_title")
    const wrote = await request(url, "tools/call", { name: "set_title", arguments: { id: "a", title: "Changed over MCP" } })
    expect((await wrote.json()).result.isError).not.toBe(true)
    const read = await request(url, "tools/call", { name: "read_node", arguments: { id: "a" } })
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
    // The request's connection is deliberately withdrawn by the switch. Its
    // response may be lost, but teardown must finish and the other face stay up.
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
      expect(tools).not.toContain("set_title")
      expect(tools).not.toContain("read_node")
      expect((await (await request(url, "resources/list")).json()).result.resources).toEqual([])
      expect((await (await request(url, "resources/templates/list")).json()).result.resourceTemplates).toEqual([])
      const rejected = await request(url, "tools/call", { name: "set_title", arguments: { id: "a", title: "must not land" } })
      const refused = (await rejected.json()).result
      expect(refused.isError).toBe(true)
      expect(JSON.stringify(refused)).toContain("capability")
      expect((await fetch(url + "/olai/resync", { method: "POST" })).status).toBe(404)
      await flip(url, "vault", true)
      const wrote = await request(url, "tools/call", { name: "set_title", arguments: { id: "a", title: `activation ${i}` } })
      expect((await wrote.json()).result.isError).not.toBe(true)
      const read = await request(url, "tools/call", { name: "read_node", arguments: { id: "a" } })
      expect(JSON.stringify(await read.json())).toContain(`activation ${i}`)
    }
  })
})

test("an explicit content selection waits for its vault and acquires tools when it arrives", async () => {
  await withServing({ root: served(), plugins: ["outlines", "ws", "mcp", "web-app"] }, async (url) => {
    const listed = await request(url)
    expect((await listed.json()).result.tools.map((tool: { name: string }) => tool.name)).not.toContain("read_node")
    expect((await fetch(url + "/olai/resync", { method: "POST" })).status).toBe(404)
    await flip(url, "vault", true)
    const read = await request(url, "tools/call", { name: "read_node", arguments: { id: "a" } })
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
  const child = startWeb({ root: served(), extra: ["--plugins=vault,mcp"], env: { OLAI_DIST_DIR: "/no-browser-build" } })
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
  const child = startWeb({ root: served(), extra: ["--profile", "surface", "--without-plugins=outlines"], env: { OLAI_DIST_DIR: "/no-browser-build" } })
  try {
    const url = await child.address()
    const listed = await request(url)
    const tools = (await listed.json()).result.tools.map((tool: { name: string }) => tool.name)
    expect(tools).toContain("read_document")
    expect(tools).not.toContain("read_node")
    expect((await fetch(url)).status).toBe(404)
  } finally { expect(await child.stop()).toBe(130) }
}, 15000)

test("CLI extra and removal flags compose a non-notebook MCP host without a vault", async () => {
  const child = startWeb({ root: served(), extra: ["--profile", "test-minimal", "--extra-plugins=mcp,test-counter", "--without-plugins=vault"], env: { OLAI_DIST_DIR: "/no-browser-build" } })
  try {
    const url = await child.address()
    const listed = await request(url)
    const tools = (await listed.json()).result.tools.map((tool: { name: string }) => tool.name)
    expect(tools).toEqual([])
    expect(tools).not.toContain("read_node")
    expect(tools).not.toContain("read_document")
    expect((await fetch(url + "/olai/resync", { method: "POST" })).status).toBe(404)
    expect((await fetch(url)).status).toBe(404)
  } finally { expect(await child.stop()).toBe(130) }
}, 15000)

test("shared write tags retain only their active content cases on the MCP catalog", async () => {
  await withServing({ root: served(), plugins: ["vault", "outlines", "markdown", "files", "capture", "ws", "mcp"] }, async url => {
    const names = async () => (await (await request(url)).json()).result.tools.map((tool: { name: string }) => tool.name) as string[]
    expect(await names()).toContain("capture")
    await flip(url, "capture", false)
    expect(await names()).not.toContain("capture")
    expect(await names()).toContain("set_title")
    await flip(url, "outlines", false)
    expect(await names()).not.toContain("set_title")
    expect(await names()).not.toContain("read_node")
    expect(await names()).toContain("write_document")
    const created = await request(url, "tools/call", { name: "create_document", arguments: { file: "independent.md", text: "# Independent" } })
    expect((await created.json()).result.isError).not.toBe(true)
    await flip(url, "outlines", true)
    expect(await names()).toContain("set_title")
    const wrote = await request(url, "tools/call", { name: "set_title", arguments: { id: "a", title: "Returned" } })
    expect((await wrote.json()).result.isError).not.toBe(true)
    await flip(url, "capture", true)
    expect(await names()).toContain("capture")
  })
})
