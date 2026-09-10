import { writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { SURFACE_WS_PATH } from "@kolu/surface-app"
/** CORE'S OWN SURFACE, which is all this dial addresses: `plugins.set` is the
 *  HOST ROOT's member and its tag stays bare. It read `@olai/bundle`'s flat
 *  aggregate of every row until #546 deleted that door — a group with every
 *  row's members in it was never what this call needed, and the aggregate
 *  described a wire nothing serves once a member carried its owner. */
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
        // #548: initialization and HTTP 200 succeeded, but the production
        // catalogue omitted inputSchema. The SDK validates every listed tool.
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
      expect(tools).not.toContain("outlines_title")
      expect(tools).not.toContain("outlines_read")
      expect((await (await request(url, "resources/list")).json()).result.resources).toEqual([])
      expect((await (await request(url, "resources/templates/list")).json()).result.resourceTemplates).toEqual([])
      const rejected = await request(url, "tools/call", { name: "outlines_title", arguments: { id: "a", title: "must not land" } })
      const refused = (await rejected.json()).result
      expect(refused.isError).toBe(true)
      // THE ADAPTER'S WORDS, and they used to be olai's. A departed row's verb
      // was in the record for the connection's whole life and a filter merely
      // hid it from `tools/list`, so calling it reached olai's own handler and
      // got "The capability for … is not active." A verb rides its row's sibling
      // entry since juspay/kolu#2234 and `reroster` takes the whole entry away,
      // so there is no handler left to word a refusal — which is the change:
      // absence is structural rather than filtered.
      // NAMED, and that is the point of the wording: an agent holding a tool
      // list from before the flip made a reasonable call against a name that
      // WAS real, so it is told the sibling was dropped and to re-read the
      // list — not "unknown tool", which tells it to doubt itself about a name
      // it did not invent.
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

test("an explicit content selection waits for its vault and acquires tools when it arrives", async () => {
  await withServing({ root: served(), plugins: ["outlines", "ws", "mcp", "web-app"] }, async (url) => {
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
    expect(tools).toContain("markdown_read")
    expect(tools).not.toContain("outlines_read")
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
    expect(tools).not.toContain("outlines_read")
    expect(tools).not.toContain("markdown_read")
    expect((await fetch(url + "/olai/resync", { method: "POST" })).status).toBe(404)
    expect((await fetch(url)).status).toBe(404)
  } finally { expect(await child.stop()).toBe(130) }
}, 15000)

/**
 * A ROW'S VERBS LEAVE WITH THE ROW — asked of the three that no ops-layer door
 * can answer, because they are the case that proves the mechanism rather than
 * the schema.
 *
 * `vault-plugins_inspect`, `vault-plugins_run` and `vault-plugins_stop` were three hand-written
 * `BespokeTool`s inside `olai-plugin-mcp`, advertised or withheld by a
 * `management` name-to-tag map in a `catalog.ts` beside them — one row's
 * vocabulary held by another row, and a map somebody had to keep in step.
 * #546 sent them home: they are `olai-plugin-vault-plugins`' own `tools.ts`
 * now, handed to the host beside that row's `faces.agent`, and the reason they
 * are offered is that the row is HERE.
 *
 * WHICH IS EXACTLY THE CLAIM NOTHING ELSE MAKES. The content rows' withdrawal
 * is covered above, but every one of those verbs lands on an `ops.*` member, so
 * a filter that had rotted into "is the ops door open" would still pass. These
 * three land on `plugins.*`, which no other row serves and no ops door
 * reaches — so if the tool list did not actually follow the roster, this is
 * where it shows.
 *
 * THE CALL IS ASKED TOO, and not only the listing. A name missing from
 * `tools/list` while its handler went on answering would be a tool an agent
 * cannot discover and can still invoke, which is worse than either half alone.
 */
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
    // THE ADAPTER'S WORDS, and they name the ROW. It was olai's "The capability
    // for … is not active." — a filter hid the verb from `tools/list` while its
    // handler stayed in the record and went on answering. A verb rides its row's
    // sibling entry since juspay/kolu#2234, so `reroster` takes the handler away
    // with the entry and the refusal can say which sibling left, which is a
    // sentence a filter could not have written.
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
