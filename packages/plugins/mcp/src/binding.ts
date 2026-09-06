/** The MCP activation owns credentials and its domain tool adapters. The host
 * supplies only a composed generation and opaque static write reservations. */
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
  readonly fenced: () => RootedSurfaceClients
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
  const rows = (): ReadonlyArray<Row> => shared.agentRows() as unknown as ReadonlyArray<Row>
  const reading: Reading = () => shared.agent()
  const panel = () => clientsFor(rows(), reading, { writer: "mcp", fence: null })
  const tickets = ticketing({ reservations: shared.writeReservations, bound: shared.agent, face: () => shared.agent().expose, ops, token: shared.token, currentTicket: options.ticket, rows })
  /**
   * A TOOL IS OFFERED BECAUSE ITS ROW IS HERE, and there is no longer a line
   * anywhere that says so.
   *
   * A FILTER STOOD HERE TWICE. First `./catalog.ts`, a hand-written
   * name-to-tag map that gated every write tool by looking its `op` up in the
   * composer's shared-tag dispatch table — the permissions duplication one seam
   * over, where a row's tool went on being advertised until somebody edited a
   * map two packages away. Then, for one commit, a `tools/list` override that
   * hid the verbs of rows that had left, because a bundle-ROOT tool survives
   * any roster and olai's verbs had to be declared at the root to keep the
   * words they were authored with.
   *
   * juspay/kolu#2234 records a tool's owner on the entry instead of spelling it
   * into the name, so a verb keeps its word and still withdraws with its row.
   * Absence is the adapter's, which is what #546 asked for, and the honest way
   * to say so is that this function does not exist.
   */
  return {
    tickets,
    // THE PANEL BUNDLE — one client per standing row, unfenced, under the
    // face's own writer. Minted per call because the roster it describes moves:
    // one held across a recompose would carry a client for a row that has left
    // and none for one that arrived. `serveSurfaceAsMcp` re-invokes this after
    // every `reroster` for exactly that reason.
    client: panel,
    get root() { return options.directory()?.root ?? "" },
    // A verified read observes staleness without waiting on the publisher gate.
    vintage: Effect.suspend(() => {
      const directory = options.directory()
      return directory ? Effect.map(directory.store.read("verified"), aged => aged.vintage) : Effect.succeed(undefined)
    }),
    fenced: () => tickets.doorAt(panel()),
    record: request => ops.commit(request, "mcp"),
    push: ops.push,
  }
}
