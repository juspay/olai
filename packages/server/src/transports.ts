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
import { Effect, Exit, Scope, Semaphore } from "effect"
import { listen, type ListenOptions } from "./listener.ts"

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
export const transportListener = (options: Omit<ListenOptions, "clientDist"> & {
  readonly clientDist?: string | Effect.Effect<string>
}) => Effect.gen(function*() {
  // Tokens belong to acquisitions, never to caller-supplied plugin names.
  let clientDist: string | undefined
  const sockets = new Set<symbol>()
  const assets = new Set<symbol>()
  const protocols = new Set<symbol>()
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
    if (sockets.size === 0 && protocols.size === 0) {
      yield* close
      yield* Effect.logInfo("no transport rows enabled")
      return
    }
    // MCP is deliberately absent: its live source below answers 404 when the
    // registration leaves, while a websocket caller can still turn it back on.
    const wanted = `${(sockets.size > 0)}/${(assets.size > 0)}`
    if (scope && shape === wanted) return
    yield* close
    const next = yield* Scope.make()
    scope = next
    url = yield* listen({
      ...options,
      port,
      websocket: (sockets.size > 0),
      clientDist: (assets.size > 0) ? clientDist : undefined,
      mcp: () => (protocols.size > 0)
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
  // Install the release before refresh can fail, so a failed bind cannot
  // leave desired state with no owner. Each acquisition gets its own token.
  const register = (owners: Set<symbol>) => Effect.acquireRelease(
    Effect.sync(() => {
      const token = Symbol()
      owners.add(token)
      return token
    }),
    (token) => Effect.gen(function*() {
      owners.delete(token)
      yield* refresh
    }),
  ).pipe(Effect.andThen(refresh))
  return {
    websocket: () => register(sockets),
    assets: () => Effect.gen(function*() {
      // Resolve and validate the build only for an asset provider. An exact
      // headless selection must not need a browser build, even in web profile.
      clientDist = typeof options.clientDist === "string" || options.clientDist === undefined
        ? options.clientDist : yield* options.clientDist
      yield* register(assets)
    }),
    protocol: () => register(protocols),
    start: Effect.gen(function*() {
      active = true
      yield* refresh
      return url
    }),
    stop,
  }
})
