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
  await withServing({ root: served(), plugins: [] }, async (url) => {
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
