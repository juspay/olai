/**
 * The browser build is an HTTP contribution, with no directory or socket to own.
 *
 * clientDist is resolved on activation. A process serving only an agent face
 * must not need a browser build just because it uses the same composition root.
 * Conversely, enabling this row must validate the build before publishing its
 * routes, so a failed lookup is a failed plugin rather than a live empty shell.
 *
 * The framework's surfaceAppLayer owns the HTTP freshness contract: the shell
 * is fresh, hashed assets are immutable, asset misses do not become HTML, and
 * the service worker and manifest have their own routes. This plugin chooses
 * the notification worker and olai's manifest; it does not reproduce that HTTP
 * machinery. The hostname comes from core's process identity so the installed
 * app and the connected header name the same machine.
 *
 * Registering the layer on this scope makes withdrawal remove all of those
 * routes together. Core rebuilds HTTP dispatch on the existing port, while the
 * socket and protocol providers keep their resources. The build can also be
 * served alone: assets do not implicitly enable a socket, a vault or agent tools.
 * The absence of a browser export is intentional. This plugin serves the build;
 * it contributes no client-side UI for the bundle generator to load.
 */
import { definePlugin } from "@olai/plugin-api"
import { TransportSurface } from "@olai/plugin-api/transport"
import { BROWSER_BOOT_PATH } from "@olai/plugin-api/mount"
import { surfaceAppLayer } from "@kolu/surface-app/server"
import { ASSET_PREFIX } from "@olai/surface"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
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
