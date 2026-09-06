/** MCP owns its HTTP carrier, domain tool adapters and scoped credential mint.
 * Optional domain services are resolved at call time, so a missing vault leaves
 * the protocol available and returns ordinary domain refusals. */
import { definePlugin } from "@olai/plugin-api"
import { Directory, HostServices, Offers, Ops } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Directory as OpenDirectory, Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"
import { bindAgent } from "./binding.ts"
import { ticketMint } from "./contract.ts"
import { endpoint } from "./endpoint.ts"
import { currentTicket } from "./route.ts"

export default definePlugin({
  name,
  needs: [TransportSurface, HostServices, Offers],
  apply: Effect.gen(function*() {
    const shared = yield* TransportSurface
    const services = yield* HostServices
    const policy = bindAgent({ shared, ticket: currentTicket,
      directory: () => services.current(Directory) as OpenDirectory | undefined,
      ops: () => services.current(Ops)?.gate as Gate | undefined,
    })
    // Offers and routes belong to the same activation; unloading withdraws the
    // mint and carrier before any subsequent activation allocates a new table.
    yield* (yield* Offers).offer(ticketMint, () => policy.tickets)
    yield* endpoint(shared, policy)
  }),
})
