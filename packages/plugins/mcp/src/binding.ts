/** The MCP activation owns credentials and its domain tool adapters. The host
 * supplies only a composed generation and opaque static write reservations. */
import type { ClientOrConnection } from "@kolu/surface-mcp"
import type { ExposeMap } from "@kolu/surface/expose"
import type { CommitRequest, CommitResult, PushResult } from "@olai/format"
import { TOOLS, liveOps, type Directory, type Ops } from "@olai/ops"
import type { TransportSurface } from "@olai/plugin-api/transport"
import { mcpContract, type McpClient } from "./client.ts"
import type { Vintage } from "@olai/store"
import { Effect } from "effect"
import { availableTools } from "./catalog.ts"
import { liveClient } from "./live-client.ts"
import { ticketing, type Tickets } from "./tickets.ts"

export interface AgentBinding {
  readonly available: (name: string) => boolean
  readonly resourceAvailable: (key: string, verb: string) => boolean
  readonly client: () => ClientOrConnection
  readonly expose: ExposeMap<typeof mcpContract.spec>
  readonly root: string
  readonly vintage: Effect.Effect<Vintage | undefined>
  readonly fenced: (client: ClientOrConnection) => ClientOrConnection
  readonly record: (request: CommitRequest) => Effect.Effect<CommitResult>
  readonly push: Effect.Effect<PushResult>
}

export const bindAgent = (options: {
  readonly shared: TransportSurface
  readonly ticket: () => string | null
  readonly directory: () => Directory | undefined
  readonly ops: () => Ops | undefined
  readonly ledger?: () => boolean
}): AgentBinding & { readonly tickets: Tickets } => {
  const { shared } = options
  const ops = liveOps(options.ops)
  const panel = liveClient(shared.agent, { writer: "mcp", fence: null })
  const tickets = ticketing({ reservations: shared.writeReservations, bound: shared.agent, face: () => shared.agent().expose, ops, token: shared.token, currentTicket: options.ticket })
  return {
    tickets,
    resourceAvailable: (key, verb) => { const bound = shared.agent(); const tag = `surface/${key}/${verb}`; return bound.expose.tags.has(tag) && tag in bound.handlers },
    available: availableTools({ tools: TOOLS, current: shared.agent, ledger: () => options.ops() !== undefined && options.ledger?.() === true }),
    expose: { outlines: "resource", documents: "resource", errors: "resource" },
    client: () => panel,
    get root() { return options.directory()?.root ?? "" },
    // A verified read observes staleness without waiting on the publisher gate.
    vintage: Effect.suspend(() => {
      const directory = options.directory()
      return directory ? Effect.map(directory.store.read("verified"), aged => aged.vintage) : Effect.succeed(undefined)
    }),
    fenced: held => tickets.doorAt(held as McpClient),
    record: request => ops.commit(request, "mcp"),
    push: ops.push,
  }
}
