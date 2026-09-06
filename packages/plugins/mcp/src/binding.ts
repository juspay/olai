/** The MCP activation owns credentials and its domain tool adapters. The host
 * supplies only a composed generation and opaque static write reservations. */
import type { ClientOrConnection } from "@kolu/surface-mcp"
import type { ExposeMap } from "@kolu/surface/expose"
import type { CommitRequest, CommitResult, PushResult } from "@olai/format"
import { liveOps, type Directory, type Ops } from "@olai/ops"
import type { TransportSurface } from "@olai/plugin-api/transport"
import { clientOver, type OlaiSurfaceClient } from "@olai/surface/client"
import type { Vintage } from "@olai/store"
import { Effect } from "effect"
import { writerAt } from "./authority.ts"
import { ticketing, type Tickets } from "./tickets.ts"

export interface AgentBinding {
  readonly client: () => ClientOrConnection
  readonly expose: ExposeMap
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
}): AgentBinding & { readonly tickets: Tickets } => {
  const { shared } = options
  const bound = shared.agent()
  const ops = liveOps(options.ops)
  const panel = clientOver({ group: bound.group, handlers: writerAt(bound, { writer: "mcp", fence: null }) }, bound.expose)
  const tickets = ticketing({ reservations: shared.writeReservations, bound, face: bound.expose, ops, token: shared.token, currentTicket: options.ticket })
  return {
    tickets,
    expose: { outlines: "resource", documents: "resource", errors: "resource" },
    client: () => panel,
    get root() { return options.directory()?.root ?? "" },
    // A verified read observes staleness without waiting on the publisher gate.
    vintage: Effect.suspend(() => {
      const directory = options.directory()
      return directory ? Effect.map(directory.store.read("verified"), aged => aged.vintage) : Effect.succeed(undefined)
    }),
    fenced: held => tickets.doorAt(held as OlaiSurfaceClient),
    record: request => ops.commit(request, "mcp"),
    push: ops.push,
  }
}
