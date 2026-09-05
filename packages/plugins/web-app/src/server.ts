/** The browser build is an HTTP contribution on the shared port. Resolve it
 * only when this plugin starts, then withdraw its routes before releasing the
 * scope. Other providers keep their routes and existing connections. */
import { definePlugin } from "@olai/plugin-api"
import { TransportSurface } from "@olai/plugin-api/transport"
import { surfaceAppLayer } from "@kolu/surface-app/server"
import { ASSET_PREFIX } from "@olai/surface"
import { Effect } from "effect"
import { manifestOf } from "./manifest.ts"
import { name } from "./index.ts"
export { name } from "./index.ts"
export default definePlugin({
  name,
  needs: [TransportSurface],
  apply: Effect.gen(function*() {
    const shared = yield* TransportSurface
    const clientDist = yield* shared.clientDist
    yield* shared.register({ routes: surfaceAppLayer({ clientDist, assetPrefix: ASSET_PREFIX, manifest: manifestOf(shared.hostname), serviceWorker: "notify" }) })
  }),
})
