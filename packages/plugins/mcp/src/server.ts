/**
 * This plugin owns the MCP projection and its HTTP carrier on the shared port.
 *
 * TransportSurface is needed after core has composed the surface and bound the
 * writer. Opening another directory or store here would create a second writer
 * with a different view of the files. Preparing an agent binding instead borrows
 * core's handlers, attribution policy and ticket fence. The plugin supplies the
 * request-local credential reader; core decides which writes that credential
 * authorizes, while tools.ts decides how the agent sees those operations as MCP.
 *
 * Acquisition order is part of the endpoint's contract. First prepare the
 * writer binding and its ticket table, then acquire the protocol server and
 * carrier, then register /mcp. No request can enter a server that is still being
 * constructed. Scope release reverses that order: withdraw the route before
 * closing protocol waiters and releasing the ticket mint. A later activation
 * gets a fresh server and tickets, without stopping somebody else's websocket.
 *
 * The HTTP request/reply protocol is argued in route.ts. It belongs here rather
 * than in the listener because its authentication and half-duplex behavior are
 * MCP decisions; the listener only ranks the route alongside other providers.
 * MCP-only serving is therefore an ordinary registration set, not a special
 * listener mode. No browser module is needed to serve an agent or to let core's
 * existing plugins panel switch this row.
 */
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
  }),
})
