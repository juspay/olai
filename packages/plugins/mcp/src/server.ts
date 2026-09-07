/**
 * MCP owns its HTTP carrier, domain tool adapters and scoped credential mint.
 *
 * ## THE ROW WANTS A TRANSPORT, and the vault is two COMPONENTS
 *
 * The protocol server, its route, its carrier and its ticket mint stand up on a
 * serve with no vault at all — a failed directory, `--plugins=mcp,ws,web-app`,
 * the vault switched off at the panel — where the endpoint keeps serving and
 * the domain tools refuse in the vault's own words. So the ROW names the
 * transport and nothing else.
 *
 * What it used to name beside it was `HostServices`, and then spend on three
 * keys it had not declared: `Directory`, `Ops` and `Ledger`. The dependency
 * graph a person reads said this row wanted a transport, while the code reached
 * for the vault's gate on every tool call (the audit's §5). Each optional half
 * is a component now — the runtime holds it `waiting` while its provider is
 * absent, says which key on the panel, and unwinds it when the provider leaves.
 */
import { definePlugin } from "@olai/plugin-api"
import { Directory, Ledger, Offers, Ops } from "@olai/plugin-api/services"
import { TransportSurface } from "@olai/plugin-api/transport"
import type { Directory as OpenDirectory, Ops as Gate } from "@olai/ops"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"
import { bindAgent } from "./binding.ts"
import { holdLedger, holdServedDoors, ledgerMounted, openDirectory, writeGate } from "./domain.ts"
import { endpoint } from "./endpoint.ts"
import { currentTicket } from "./route.ts"

export default definePlugin({
  name,
  needs: [TransportSurface, Offers],
  apply: Effect.gen(function*() {
    const shared = yield* TransportSurface
    const policy = bindAgent({ shared, ticket: currentTicket,
      directory: openDirectory,
      ops: writeGate,
      ledger: ledgerMounted,
    })
    // Offers and routes belong to the same activation; unloading withdraws the
    // mint and carrier before any subsequent activation allocates a new table.
    yield* (yield* Offers).own("ticket-mint", () => policy.tickets)
    yield* endpoint(shared, policy)
  }),
})

export const components = {
  /** The vault's own doors — DECLARED, on a component of its own so `/mcp`
   *  survives a serve with no directory (`./domain.ts`). */
  "served-doors": definePlugin({
    name: "served-doors",
    needs: [Directory, Ops],
    apply: Effect.gen(function*() {
      const directory = (yield* Directory) as OpenDirectory
      const ops = (yield* Ops).gate as Gate
      yield* Effect.acquireRelease(
        Effect.sync(() => holdServedDoors({ directory, ops })), stop => Effect.sync(stop))
    }),
  }),
  /** ...and whether writes are recorded into a history, which is the git row's
   *  and moves independently of the vault's. */
  ledger: definePlugin({
    name: "ledger",
    needs: [Ledger],
    apply: Effect.gen(function*() {
      yield* Ledger
      yield* Effect.acquireRelease(Effect.sync(holdLedger), stop => Effect.sync(stop))
    }),
  }),
}
