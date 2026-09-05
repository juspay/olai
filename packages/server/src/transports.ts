/**
 * Independent transport rows over one shared listener.
 *
 * A row owns a registration, not a private port. ws and mcp both expose the
 * same vault at the same address, and the framework binds HTTP, browser assets
 * and websocket admission together. Giving each row a listener would either
 * make them fight for that port or make every caller learn a second address.
 * The coordinator therefore owns one serving scope and the rows declare what
 * it serves. The framework still owns websocket admission and socket draining.
 *
 * There are two clocks. Websocket and browser-build presence are options read
 * when the listener binds; changing them rebuilds that scope. MCP presence is
 * read on each request, so its row can leave without dropping the browser's
 * control socket. The shape below contains only the first two choices. Folding
 * MCP into it would conflate a route change with a listener change and make an
 * ordinary panel toggle disconnect the very request asking for it.
 */
import { definePlugin, serviceTag } from "@olai/plugin-api"
import { Effect, Exit, Scope, Semaphore } from "effect"
import { listen, type ListenOptions } from "./listener.ts"
import { TRANSPORT_ROWS, transportModuleName, type TransportRow } from "./profiles.ts"

/** The root provides this only after bind has composed the surface and write
 * gate. Mounting rows earlier leaves them pending on a real dependency rather
 * than loading while awaiting a callback the root cannot yet complete.
 *
 * mcp's protocol acquisition differs from registering its route. It owns the
 * SDK server and ticket mint on its own row scope; ws has no separate protocol
 * server to acquire, since the shared listener owns its websocket stacks. Both
 * still register their presence with the same scoped verb. */
export const TransportSurface = serviceTag<{
  readonly register: (row: TransportRow) => Effect.Effect<void, never, Scope.Scope>
  readonly mcp: Effect.Effect<void, never, Scope.Scope>
}>("transport-surface")

export const transportModules = Object.fromEntries(
  TRANSPORT_ROWS.map((row) => [
    transportModuleName(row),
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

/**
 * Build the coordinator before activating the rows, then start it after they
 * settle. Registrations at boot only collect choices; binding midway through
 * that collection would announce readiness before MCP exists and might change
 * an OS-assigned port again as web-app arrives. Once started, the same scoped
 * registrations drive live reconciliation and every release removes its row.
 *
 * Scope ownership stays here even though a row's release can trigger refresh:
 * the old listener must finish closing before its replacement binds. A permit
 * serializes those resource transitions. The registration set is the desired
 * state; shape describes the scope that successfully acquired a port, so a
 * failed acquisition cannot claim that its desired shape is already serving.
 */
export const transportListener = (options: ListenOptions) => Effect.gen(function*() {
  const rows = new Set<TransportRow>()
  const lock = Semaphore.makeUnsafe(1)
  let active = false
  let scope: Scope.Closeable | undefined
  // Retain the OS's first answer across rebuilds, including a busy-port retry.
  // Sessions were handed that address once; each refresh must try it first.
  let port = options.port
  let url: string | undefined
  let shape: string | undefined
  // Clear the installed state before awaiting teardown. An interrupted or
  // failing release must never leave a closed scope described as still live.
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
    // MCP is deliberately absent: its live source below answers 404 when the
    // registration leaves, while a websocket caller can still turn it back on.
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
  // Shutdown changes the policy before closing the resource. Subsequent row
  // finalizers still remove their registrations, but must not bind a fresh
  // listener while the root is withdrawing TransportSurface.
  const stop = lock.withPermit(Effect.gen(function*() {
    active = false
    yield* close
  }))
  yield* Effect.addFinalizer(() => stop)
  return {
    // Install the release before refresh can fail. Otherwise a failed bind
    // during acquisition would leave a row in the desired set with no owner.
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
