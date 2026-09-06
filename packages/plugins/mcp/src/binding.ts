/** The MCP activation owns credentials and its domain tool adapters. The host
 * supplies only a composed generation and opaque static write reservations. */
import type { ClientOrConnection } from "@kolu/surface-mcp"
import type { ExposeMap } from "@kolu/surface/expose"
import { scopeSiblingTag } from "@kolu/surface/define"
import type { CommitRequest, CommitResult, PushResult } from "@olai/format"
import { liveOps, type Directory, type Ops, type Tool } from "@olai/ops"
import type { TransportSurface } from "@olai/plugin-api/transport"
import { AGENT_EXPOSE, mcpContract, ownerIn, type McpClient, type Row } from "./client.ts"
import type { Vintage } from "@olai/store"
import { Effect } from "effect"
import { liveClient, toOwner } from "./live-client.ts"
import { ticketing, type Tickets } from "./tickets.ts"
import { pluginVerbs } from "./tools.ts"

export interface AgentBinding {
  readonly available: (name: string) => boolean
  readonly resourceAvailable: (key: string, verb: string) => boolean
  readonly client: () => ClientOrConnection
  readonly expose: ExposeMap<typeof mcpContract.spec>
  /** Every verb this BUILD has, as the adapter's static tool record — see
   *  `@olai/bundle`'s `tools.ts` for why it is the build's and not the
   *  roster's, and {@link available} for the half that is the roster's. */
  readonly tools: ReadonlyArray<Tool>
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
  const rows = (): ReadonlyArray<Row> => shared.agentRows()
  const route = toOwner(rows)
  const panel = liveClient(shared.agent, { writer: "mcp", fence: null }, route)
  const tickets = ticketing({ reservations: shared.writeReservations, bound: shared.agent, face: () => shared.agent().expose, ops, token: shared.token, currentTicket: options.ticket, route })
  /**
   * WHICH TOOLS ARE OFFERED RIGHT NOW — the rows that are standing, and nothing
   * else.
   *
   * THIS REPLACED A HAND-WRITTEN CATALOGUE (`./catalog.ts`, deleted by #546),
   * and the two answer the same question from opposite ends. That file held a
   * name-to-tag map for the six read tools and three plugin verbs, and gated
   * every WRITE tool by looking its `op` up in the composer's shared-tag
   * dispatch table — because while six rows answered one bare
   * `surface/ops/run`, "who owns `title`" was not a question a tag could
   * settle. It was the permissions duplication one seam over: a row's tool went
   * on being advertised until somebody edited a map two packages away.
   *
   * A tool is offered because the ROW THAT BROUGHT IT IS HERE. Nothing is
   * looked up, nothing is kept in step, and a row that leaves takes its verbs
   * with it in the same instant it stops serving their tags
   * (`@olai/server`'s `profiles.test.ts`).
   */
  const offered = (name: string): boolean => {
    const verb = pluginVerbs[name]
    if (verb !== undefined) return ownerIn(rows(), "plugins", verb) !== undefined
    return rows().some(row => row.tools.some(tool => (tool as Tool).name === name))
  }
  return {
    tickets,
    /**
     * WHICH RESOURCES ARE READABLE — the same question about the three members
     * `expose` names, asked of the row that declares each.
     *
     * Two conditions rather than one, and the second is not paranoia: a row can
     * be STANDING and still not grant this face the member. `ownerIn` says who
     * declares it, and the exposure says whether the agent may have it — which
     * is the row's own `faces.agent` map, written in the row's own package.
     */
    resourceAvailable: (key, verb) => {
      const owner = ownerIn(rows(), key, verb)
      if (owner === undefined) return false
      const bound = shared.agent()
      const tag = scopeSiblingTag(`surface/${key}/${verb}`, owner)
      return bound.expose.tags.has(tag) && tag in bound.handlers
    },
    available: offered,
    tools: shared.agentTools().flatMap(row => row.tools as ReadonlyArray<Tool>),
    expose: AGENT_EXPOSE,
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
