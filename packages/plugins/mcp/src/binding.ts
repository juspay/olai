import type { RootedSurfaceClients } from "@kolu/surface/client"
import type { CommitRequest, CommitResult, PushResult } from "@olai/format"
import { liveOps, type Directory, type Ops } from "@olai/ops"
import type { TransportSurface } from "@olai/plugin-api/transport"
import { clientsFor, type Row } from "./bundle.ts"
import type { Reading } from "./live-client.ts"
import type { Vintage } from "@olai/store"
import { Effect } from "effect"
import { ticketing, type Tickets } from "./tickets.ts"

export interface AgentBinding {
  readonly client: () => RootedSurfaceClients
  readonly root: string
  readonly vintage: Effect.Effect<Vintage | undefined>
  readonly doorAt: () => RootedSurfaceClients
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
  const ops = liveOps(options.ops)
  const rows = (): ReadonlyArray<Row> => shared.agentRows() as unknown as ReadonlyArray<Row>
  const reading: Reading = () => shared.agent()
  const panel = () => clientsFor(rows(), reading, { writer: "mcp" })
  const tickets = ticketing({ reservations: shared.writeReservations, bound: shared.agent, face: () => shared.agent().expose, ops, token: shared.token, currentTicket: options.ticket, rows })
  return {
    tickets,
    client: panel,
    get root() { return options.directory()?.root ?? "" },
    vintage: Effect.suspend(() => {
      const directory = options.directory()
      return directory ? Effect.map(directory.store.read("verified"), aged => aged.vintage) : Effect.succeed(undefined)
    }),
    doorAt: () => tickets.doorAt(panel()),
    record: request => ops.commit(request, "mcp"),
    push: ops.push,
  }
}
