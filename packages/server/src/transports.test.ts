import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import * as fs from "node:fs"
import { join } from "node:path"
import * as Store from "@olai/store"
import { codecFor, make as makeOps } from "@olai/ops"
import { NO_KINDS } from "@olai/format"
import { bind } from "./runtime.ts"
import { watchFault } from "./fault.ts"
import { served, SERVER_LAYERS } from "./serve.testlib.ts"
import { transportListener } from "./transports.ts"
import { mcpEndpoint } from "./mcp/endpoint.ts"

// Exercise resource withdrawal directly: once ws is gone there is deliberately
// no browser control socket through which a test could turn it back on.
test("transport registrations release and restore browser assets, sockets and the last port", async () => {
  const root = served()
  fs.writeFileSync(join(root, "index.html"), "<!doctype html><p>browser build</p>")
  try {
    await Effect.gen(function*() {
      const store = yield* Store.make({ root, codec: codecFor(NO_KINDS), watch: false })
      const ops = makeOps({ store, root })
      const wired = yield* bind({ store, ops, plugins: null, writer: "web", hostname: "test", startedAt: new Date().toISOString() })
      const fault = yield* watchFault(wired.bound)
      yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
      yield* Effect.addFinalizer(() => fault.stopped)
      const endpoint = mcpEndpoint("test")
      const ticket = () => endpoint.ticketFor(() => ({ under: "a", forbidden: [] }), () => null, "mcp")
      expect(ticket()).toBeNull()
      const listener = yield* transportListener({
        bound: wired.bound, expose: () => wired.faces.browser, root, clientDist: root,
        hostname: "test", host: "127.0.0.1", port: 0, allowedOrigins: [],
        upgradeHeaders: () => [], who: () => null,
        mcp: endpoint.route(() => null),
        resync: Effect.void, plugins: null,
      })
      const parent = yield* Effect.scope
      let mcp = yield* Scope.fork(parent)
      const startMcp = endpoint.serve({ bound: wired.bound, face: wired.faces.agent, ops, root, writer: "mcp", vintage: Effect.map(store.read("verified"), (aged) => aged.vintage) })
      let ws = yield* Scope.fork(parent)
      let app = yield* Scope.fork(parent)
      yield* startMcp.pipe(Scope.provide(mcp))
      yield* listener.register("mcp").pipe(Scope.provide(mcp))
      const first = ticket()
      expect(first).not.toBeNull()
      yield* listener.register("ws").pipe(Scope.provide(ws))
      yield* listener.register("web-app").pipe(Scope.provide(app))
      const url = (yield* listener.start)!
      const status = (path: string) => Effect.promise(async () => (await fetch(url + path, { signal: AbortSignal.timeout(3000) })).status)
      expect(yield* status("/")).toBe(200)
      yield* Scope.close(app, Exit.void)
      expect(yield* status("/")).toBe(404)
      expect(yield* status("/mcp")).toBe(405)
      app = yield* Scope.fork(parent)
      yield* listener.register("web-app").pipe(Scope.provide(app))
      expect(yield* status("/")).toBe(200)
      yield* Scope.close(ws, Exit.void)
      expect(yield* status("/olai/who")).toBe(404)
      expect(yield* status("/mcp")).toBe(405)
      ws = yield* Scope.fork(parent)
      yield* listener.register("ws").pipe(Scope.provide(ws))
      expect(yield* status("/olai/who")).toBe(204)
      expect(yield* status("/")).toBe(200)
      yield* Scope.close(ws, Exit.void)
      yield* Scope.close(mcp, Exit.void)
      expect(ticket()).toBeNull()
      yield* Effect.promise(async () => { await expect(fetch(url)).rejects.toThrow() })
      // Re-activating MCP gets a fresh ticket table while reusing the serve's
      // address. Releasing an old ticket cannot affect that new activation.
      mcp = yield* Scope.fork(parent)
      yield* startMcp.pipe(Scope.provide(mcp))
      yield* listener.register("mcp").pipe(Scope.provide(mcp))
      const second = ticket()
      expect(second).not.toBeNull()
      expect(second!.bearer).not.toBe(first!.bearer)
      first!.release()
      expect(yield* status("/mcp")).toBe(405)
      second!.release()
      yield* Scope.close(mcp, Exit.void)
      expect(ticket()).toBeNull()
      yield* Scope.close(app, Exit.void)
    }).pipe(Effect.scoped, Effect.provide(SERVER_LAYERS), Effect.runPromise)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
