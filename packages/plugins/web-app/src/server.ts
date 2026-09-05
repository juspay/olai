/** Browser assets share the surface listener's address and lifetime.
 * This row names TransportSurface rather than the port: assets alone do not
 * open a listener, and a second socket would compete with the transports that
 * serve the same app. Its scoped registration controls whether the shared
 * listener serves the build; unloading withdraws only this acquisition. */
import { definePlugin } from "@olai/plugin-api"
import { TransportSurface } from "@olai/plugin-api/transport"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [TransportSurface],
  apply: Effect.gen(function*() {
    const surface = yield* TransportSurface
    yield* surface.assets()
  }),
})
