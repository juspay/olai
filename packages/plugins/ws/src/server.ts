/** Websocket admission belongs to this plugin, over core's composed surface
 * and writer policy. The shared listener dispatches upgrades to this scoped
 * contribution. Gate origin, stale tabs and liveness before serving; withdraw
 * admission before draining connections when the plugin leaves. HTTP route
 * providers can change without disturbing this population of sockets. */
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
