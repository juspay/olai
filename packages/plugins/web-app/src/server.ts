import { definePlugin } from "@olai/plugin-api"
import { TransportSurface } from "@olai/plugin-api/transport"
import { BROWSER_BOOT_PATH } from "@olai/plugin-api/mount"
import { surfaceAppLayer } from "@kolu/surface-app/server"
import { ASSET_PREFIX } from "@olai/surface"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { manifestOf } from "./manifest.ts"
import { name } from "./index.ts"
export { name } from "./index.ts"
export default definePlugin({
  name,
  needs: [TransportSurface],
  apply: Effect.gen(function*() {
    const shared = yield* TransportSurface
    const clientDist = yield* shared.clientDist
    yield* shared.register({ routes: Layer.mergeAll(
      surfaceAppLayer({ clientDist, assetPrefix: ASSET_PREFIX, manifest: manifestOf(shared.hostname), serviceWorker: "notify" }),
      HttpRouter.add("GET", BROWSER_BOOT_PATH, () => Effect.orDie(HttpServerResponse.json(
        shared.browserBoot?.() ?? [], { headers: { "cache-control": "no-store" } },
      ))),
    ) })
  }),
})
