/**
 * MCP owns its HTTP carrier, domain tool adapters and scoped credential mint.
 *
 * ## THE ROW NAMES THE SERVED DIRECTORY, and may be without one
 *
 * The protocol server, its route, its carrier and its ticket mint stand up on a
 * serve with no vault at all — a failed directory, a policy selecting only mcp, ws, web-app,
 * the vault switched off at the panel — where the endpoint keeps serving and
 * the domain tools refuse in the vault's own words.
 *
 * What this row used to name was `HostServices`, and then spend on three keys
 * it had not declared: `Directory`, `Ops` and `Ledger`. The dependency graph a
 * person reads (`plugins.inspect`, the panel's *carrying* sentence, the row's
 * own `needs`) said this row wanted a transport, while the code reached for the
 * vault's gate on every tool call. That is the audit's §5, and it is why
 * `HostServices` no longer exists at all.
 *
 * {@link Served} is what replaced it, and its own paragraph carries why the
 * answer here is a broker rather than the registration the vault's views got:
 * this row cannot invert the arrow (a vault that registered its gate with the
 * transport would be the directory knowing what an MCP endpoint is) and cannot
 * put the reach on a COMPONENT either, because a row that reads `waiting` is
 * reported to the roster as not running.
 *
 * THE LEDGER READING IS GONE rather than declared. `bindAgent` took a `ledger`
 * predicate, `HostServices` answered it, and no line in this package ever read
 * it: `git_commit` and `git_push` go through the write gate, which refuses in
 * the vault's words on a serve with no history. An undeclared reach for an
 * answer nobody wanted.
 */
import { definePlugin } from "@olai/plugin-api"
import { Offers, Served } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Directory as OpenDirectory, Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"
import { bindAgent } from "./binding.ts"
import { advertisedFrom } from "./catalogue.ts"
import { endpoint } from "./endpoint.ts"
import { currentTicket } from "./route.ts"

export default definePlugin({
  name,
  needs: [TransportSurface, Served, Offers],
  apply: Effect.gen(function*() {
    const shared = yield* TransportSurface
    const served = yield* Served
    const policy = bindAgent({ shared, ticket: currentTicket,
      // PER CALL, both of them: the roster moves under a standing connection,
      // and a vault switched off mid-session must refuse the NEXT tool call
      // rather than the one after the next reconnect.
      directory: () => served.directory() as OpenDirectory | undefined,
      ops: () => served.gate() as Gate | undefined,
    })
    // Offers and routes belong to the same activation; unloading withdraws the
    // mint and carrier before any subsequent activation allocates a new table.
    yield* (yield* Offers).own("ticket-mint", () => policy.tickets)
    yield* (yield* Offers).own("catalogue", () => ({ advertised: advertisedFrom(() => shared.agentRows()) }))
    yield* endpoint(shared, policy)
  }),
})
