/** The MCP row owns a protocol server over the host's composed surface.
 * TransportSurface supplies the writer-bound client, tickets and HTTP carrier;
 * acquiring a private port here would split one serve across two addresses.
 * Acquire the protocol before advertising its route so a request can never
 * enter an endpoint that is still loading. Reverse scope order withdraws the
 * route before closing the server and its ticket mint on unload or failure. */
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
    yield* surface.protocol()
  }),
})
