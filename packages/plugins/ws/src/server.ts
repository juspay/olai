/**
 * Websocket admission is this plugin's resource; the shared port is core's.
 *
 * Why compose the socket primitives instead of calling serveSurfaceApp?
 * That convenience owns an entire HTTP server, its shell routes and its
 * websocket population. Calling it here would acquire a second port or make
 * this plugin the owner of every other transport's lifetime. We need only its
 * admission sequence: origin gate, upgrade, stale-tab gate, heartbeat enrollment
 * and serving. Kolu owns those primitives and their protocol constants; this
 * plugin composes them over the handlers and policy supplied by core.
 *
 * The generation and the header allowlist have different failure contracts.
 * Both are read at each accept because plugin registrations can change while
 * the process keeps its port. A group and exposure that disagree cannot serve
 * an honest socket: restrictHandlers refuses that generation and the peer is
 * terminated. An invalid header allowlist does not invalidate the surface.
 * It is reported as UpgradeHeadersRefused, and that connection carries no named
 * headers. Core then resolves its writer identity as anonymous. Catching both
 * failures together would either admit a bad generation or unnecessarily drop
 * a working socket because an identity provider failed.
 *
 * The origin gate runs on the raw socket, before an attacker page has a
 * websocket. The accepted peer then passes the stale-process and liveness
 * gates before a serving stack is acquired. Frame size and heartbeat cadence
 * remain the framework's decisions, not local numbers to keep synchronized.
 *
 * Registration is last on the activation scope, so withdrawal is first on
 * release: no new upgrade can enter while this population is drained. Every
 * serving stack is awaited, remaining raw peers are terminated, and the
 * heartbeat reaper stops. Neither removing assets nor changing an HTTP route
 * owns these peers, so neither operation releases them. Core owns the composed
 * runtime and closes it after plugin teardown; a socket only borrows it.
 */
import { definePlugin } from "@olai/plugin-api"
import { TransportSurface } from "@olai/plugin-api/transport"
import { SURFACE_WS_PATH } from "@kolu/surface-app"
import { acceptSurfaceSocket, serveSurfaceSocket, type ServableSocket, type SurfaceSocketServing } from "@kolu/surface-app/server"
import { checkUpgradeHeaders, pickUpgradeHeaders } from "@kolu/surface-app/upgrade-headers"
import { restrictHandlers } from "@kolu/surface/expose"
import { RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit"
import { gateWsOrigin } from "@kolu/surface/ws-origin"
import { toError } from "@kolu/surface/run-stream"
import type { SurfaceAppConnection } from "@kolu/surface-app/serve"
import { WebSocketServer } from "ws"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"

export const upgrade = (shared: TransportSurface) => Effect.gen(function*() {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: RPC_MAX_FRAME_BYTES })
  const report = shared.report
  const acceptor = acceptSurfaceSocket({
    server: sockets,
    onError: (error, url) => report({ _tag: "SocketError", error, url }),
    onReject: (claimedPid, url) => report({ _tag: "StaleTab", claimedPid, url }),
  })
  const servings = new Set<SurfaceSocketServing>()
  let accepted = 0
  yield* Effect.addFinalizer(() => Effect.promise(async () => {
    acceptor.stop()
    await Promise.all([...servings].map((serving) => { serving.close(); return serving.done.catch(() => {}) }))
    for (const peer of sockets.clients) peer.terminate()
    sockets.close()
  }))
  yield* shared.register({
    routes: shared.routes,
    upgrade: {
      path: SURFACE_WS_PATH,
      handle: (request, socket, head) => {
        const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
        if (gateWsOrigin(request, socket, { allowedOrigins: shared.allowedOrigins, onReject: (origin) => report({ _tag: "DisallowedOrigin", origin, url }) })) return
        sockets.handleUpgrade(request, socket, head, (peer) => {
          acceptor.accept(peer, url, () => {
            let served
            try {
              const source = typeof shared.live === "function" ? shared.live() : shared.live
              served = { group: source.group, handlers: restrictHandlers(source.group, source.handlers, source.expose) }
            } catch (cause) {
              peer.terminate()
              report({ _tag: "GenerationRefused", error: toError(cause), url })
              return
            }
            let named: ReadonlyArray<string> = []
            try { named = shared.upgradeHeaders(); checkUpgradeHeaders(named) }
            catch (cause) { named = []; report({ _tag: "UpgradeHeadersRefused", error: toError(cause), url }) }
            const connection: SurfaceAppConnection<string> = Object.freeze({ id: ++accepted, url, remoteAddress: request.socket.remoteAddress, headers: pickUpgradeHeaders(request, named) })
            report({ _tag: "Connected", connection })
            peer.once("close", (code, reason) => report({ _tag: "Disconnected", connection, code, reason: reason.toString() }))
            const serving = serveSurfaceSocket({ group: served.group, handlers: served.handlers, socket: peer as unknown as ServableSocket, services: shared.services(connection) })
            servings.add(serving)
            void serving.done.catch((cause: unknown) => report({ _tag: "ServingFailed", cause, connection })).finally(() => servings.delete(serving))
          })
        })
      },
    },
  })
})
export default definePlugin({ name, needs: [TransportSurface], apply: Effect.flatMap(TransportSurface, upgrade) })
