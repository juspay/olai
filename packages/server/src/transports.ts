/** The listener has one port, shared by independently scoped transport rows.
 * Changes rebuild its serving scope at the same address. The framework owns
 * websocket admission and draining; the HTTP-only arm mounts no websocket. */
import { definePlugin, serviceTag } from "@olai/plugin-api"
import { Effect, Exit, Scope, Semaphore } from "effect"
import { listen, type ListenOptions } from "./listener.ts"
import type { TransportRow } from "./profiles.ts"

export const TransportSurface = serviceTag<{
  readonly register: (row: TransportRow) => Effect.Effect<void, never, Scope.Scope>
  readonly mcp: Effect.Effect<void, never, Scope.Scope>
}>("transport-surface")

export const transportModules = Object.fromEntries(
  (["ws", "mcp", "web-app"] as const).map((row) => [
    `olai:${row}`,
    definePlugin({
      name: row,
      needs: [TransportSurface],
      apply: Effect.gen(function*() {
        const surface = yield* TransportSurface
        if (row === "mcp") yield* surface.mcp
        yield* surface.register(row)
      }),
    }),
  ]),
)

export const transportListener = (options: ListenOptions) => Effect.gen(function*() {
  const rows = new Set<TransportRow>()
  const lock = Semaphore.makeUnsafe(1)
  let active = false
  let scope: Scope.Closeable | undefined
  let port = options.port
  let url: string | undefined
  let shape: string | undefined
  const close = Effect.gen(function*() {
    const old = scope
    scope = undefined
    shape = undefined
    if (old) yield* Scope.close(old, Exit.void)
  })
  const refresh = lock.withPermit(Effect.gen(function*() {
    if (!active) return
    if (!rows.has("ws") && !rows.has("mcp")) {
      yield* close
      yield* Effect.logInfo("no transport rows enabled")
      return
    }
    const wanted = `${rows.has("ws")}/${rows.has("web-app")}`
    if (scope && shape === wanted) return
    yield* close
    const next = yield* Scope.make()
    scope = next
    url = yield* listen({
      ...options,
      port,
      websocket: rows.has("ws"),
      clientDist: rows.has("web-app") ? options.clientDist : undefined,
      mcp: () => rows.has("mcp")
        ? (typeof options.mcp === "function" ? options.mcp() : options.mcp)
        : undefined,
    }).pipe(Scope.provide(next), Effect.orDie)
    port = Number(new URL(url).port)
    shape = wanted
    yield* Effect.annotateLogs(Effect.logInfo("serving"), { url })
  }))
  const stop = lock.withPermit(Effect.gen(function*() {
    active = false
    yield* close
  }))
  yield* Effect.addFinalizer(() => stop)
  return {
    register: (row: TransportRow) => Effect.acquireRelease(
      Effect.sync(() => { rows.add(row) }),
      () => Effect.gen(function*() {
        rows.delete(row)
        yield* refresh
      }),
    ).pipe(Effect.andThen(refresh)),
    start: Effect.gen(function*() {
      active = true
      yield* refresh
      return url
    }),
    stop,
  }
})
