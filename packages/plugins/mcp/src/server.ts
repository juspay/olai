import { definePlugin } from "@olai/plugin-api"
import { TransportSurface } from "@olai/plugin-api/transport"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"
import { endpoint } from "./endpoint.ts"

export default definePlugin({
  name,
  needs: [TransportSurface],
  apply: Effect.gen(function*() {
    const surface = yield* TransportSurface
    yield* endpoint(surface)
    yield* surface.register(name)
  }),
})
