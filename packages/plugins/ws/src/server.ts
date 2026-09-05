/** The browser socket is a scoped capability on the composed surface.
 * TransportSurface is provided after binding, so this row waits for a real
 * surface rather than acquiring a port before there is anything to serve.
 * The host shares that port with other capabilities and drains sockets when
 * their last registration leaves. The row owns only its own registration. */
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
    yield* surface.websocket()
  }),
})
