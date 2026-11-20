import { definePlugin } from "@olai/plugin-api"
import { Offers, Served } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Directory as OpenDirectory, Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"
import { bindAgent } from "./binding.ts"
import { advertisedFrom } from "./catalogue.ts"
import { endpoint, SERVER_INFO } from "./endpoint.ts"
import { currentTicket } from "./route.ts"

export default definePlugin({
  name,
  needs: [TransportSurface, Served, Offers],
  apply: Effect.gen(function*() {
    const shared = yield* TransportSurface
    const served = yield* Served
    const policy = bindAgent({ shared, ticket: currentTicket,
      // PER CALL, both of them: a vault switched off mid-session must refuse
      // the NEXT tool call rather than the one after the next reconnect.
      directory: () => served.directory() as OpenDirectory | undefined,
      ops: () => served.gate() as Gate | undefined,
    })
    // Unloading withdraws the mint, catalogue and carrier before any subsequent
    // activation allocates a new table.
    yield* (yield* Offers).own("ticket-mint", () => policy.tickets)
    const catalogue = { advertised: advertisedFrom(SERVER_INFO.name, () => shared.agentRows()) }
    yield* (yield* Offers).own("catalogue", () => catalogue)
    yield* endpoint(shared, policy)
  }),
})
