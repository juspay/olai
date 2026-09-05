/** The shared listener's scoped registrations, available after surface binding.
 * Protocol options cross this server-only door; no browser graph loads the SDK. */
import { serviceTag } from "./index.ts"
import type { Effect, Scope } from "effect"
import type { BespokeTool, ClientOrConnection } from "@kolu/surface-mcp"
import type { ExposeMap } from "@kolu/surface/expose"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"

export interface TransportSurface {
  /** Every call owns an independent registration; releasing one provider does
   * not withdraw another provider of the same capability. */
  readonly websocket: () => Effect.Effect<void, never, Scope.Scope>
  readonly assets: () => Effect.Effect<void, never, Scope.Scope>
  readonly protocol: () => Effect.Effect<void, never, Scope.Scope>
  /** Prepares a fresh ticket table on the caller's scope; the plugin acquires
   * its protocol server over these options before registering HTTP presence. */
  readonly prepareProtocol: Effect.Effect<{
    readonly client: () => ClientOrConnection
    readonly tools: Record<string, BespokeTool>
    readonly transport: Transport
    readonly expose: ExposeMap
  }, never, Scope.Scope>
}
export const TransportSurface = serviceTag<TransportSurface>("transport-surface")
