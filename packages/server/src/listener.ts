/** One port for scoped HTTP routes and upgrade handlers. The listener does not
 * know which plugins contributed them. Route changes replace HTTP dispatch;
 * an upgrade belongs to its provider's scope and survives unrelated changes. */
import { NodeHttpServer } from "@effect/platform-node"
import { codeOf } from "@olai/log"
import type { ListenerContribution, Routes } from "@olai/plugin-api/transport"
import { Data, Effect, Exit, Layer, Scope, Semaphore } from "effect"
import { HttpRouter } from "effect/unstable/http"
import type { Socket } from "node:net"
import { createServer, type RequestListener } from "node:http"

export class ListenFailed extends Data.TaggedError("ListenFailed")<{
  readonly host: string; readonly port: number; readonly cause: unknown
}> {
  override get message(): string { return `cannot listen on ${this.host}:${this.port}: ${String(this.cause)}` }
}

export interface ListenOptions {
  readonly host: string
  readonly port: number
  readonly routes?: Routes
}

export const listener = (options: ListenOptions) => Effect.gen(function*() {
  const entries = new Map<symbol, ListenerContribution>()
  const lock = Semaphore.makeUnsafe(1)
  const connections = new Set<Socket>()
  let active = false
  let server: ReturnType<typeof createServer> | undefined
  let httpScope: Scope.Closeable | undefined
  let handler: RequestListener = (_request, response) => { response.writeHead(404); response.end() }
  let port = options.port
  let url: string | undefined

  const close = Effect.gen(function*() {
    const old = server
    server = undefined
    if (old) {
      yield* Effect.promise(() => new Promise<void>((resolve) => {
        for (const connection of connections) connection.destroy()
        old.closeAllConnections()
        old.close(() => resolve())
      }))
    }
    if (httpScope) yield* Scope.close(httpScope, Exit.void)
    httpScope = undefined
  })
  const refresh = lock.withPermit(Effect.gen(function*() {
    if (!active) return
    if (entries.size === 0) {
      yield* close
      yield* Effect.logInfo("no transport rows enabled")
      return
    }
    const next = yield* Scope.make()
    const layers = [options.routes ?? Layer.empty, ...[...entries.values()].flatMap((entry) => entry.routes ? [entry.routes] : [])]
    const nextHandler = yield* Effect.gen(function*() {
      const app = yield* HttpRouter.toHttpEffect(Layer.mergeAll(layers[0]!, ...layers.slice(1)))
      return yield* NodeHttpServer.makeHandler(app, { scope: next })
    }).pipe(Scope.provide(next), Effect.provide(NodeHttpServer.layerHttpServices), Effect.orDie)
    const previous = httpScope
    httpScope = next
    handler = nextHandler
    if (previous) yield* Scope.close(previous, Exit.void)
    if (server) return
    const opened = createServer((request, response) => handler(request, response))
    server = opened
    opened.on("connection", (socket) => { connections.add(socket); socket.once("close", () => connections.delete(socket)) })
    opened.on("upgrade", (request, socket, head) => {
      const path = new URL(request.url ?? "/", "http://listener").pathname
      const contribution = [...entries.values()].find((entry) => entry.upgrade?.path === path)
      if (contribution?.upgrade) contribution.upgrade.handle(request, socket, head)
      else socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
    })
    const bind = (at: number) => Effect.tryPromise({
      try: () => new Promise<void>((resolve, reject) => {
        const failed = (error: Error) => reject(error)
        opened.once("error", failed)
        opened.listen(at, options.host, () => { opened.off("error", failed); resolve() })
      }),
      catch: (cause) => new ListenFailed({ host: options.host, port: at, cause }),
    })
    const asked = port
    let fallback = false
    yield* Effect.catchIf(bind(port), (error) => codeOf(error.cause) === "EADDRINUSE", () =>
      Effect.andThen(Effect.sync(() => { fallback = true }), bind(0)),
    ).pipe(Effect.orDie)
    const address = opened.address()
    if (!address || typeof address === "string") return yield* Effect.die(new Error("listener has no TCP address"))
    port = address.port
    url = `http://${options.host.includes(":") ? `[${options.host}]` : options.host}:${port}`
    if (fallback) yield* Effect.annotateLogs(Effect.logWarning("port in use"), { asked, url })
    yield* Effect.annotateLogs(Effect.logInfo("serving"), { url })
  }))
  const stop = lock.withPermit(Effect.gen(function*() { active = false; yield* close }))
  yield* Effect.addFinalizer(() => stop)
  return {
    register: (entry: ListenerContribution) => Effect.acquireRelease(
      Effect.sync(() => { const id = Symbol(); entries.set(id, entry); return id }),
      (id) => Effect.gen(function*() { entries.delete(id); yield* refresh }),
    ).pipe(Effect.andThen(refresh)),
    start: Effect.gen(function*() { active = true; yield* refresh; return url }),
    stop,
  }
})

/** Direct listener users contribute the same route layers as plugins. */
export const listen = (options: ListenOptions & { readonly contributions: ReadonlyArray<ListenerContribution> }) => Effect.gen(function*() {
  const port = yield* listener(options)
  for (const contribution of options.contributions) yield* port.register(contribution)
  return (yield* port.start)!
})
