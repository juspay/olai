import type { SurfaceSpec } from "@kolu/surface/define"
import type { AgentBinding } from "./binding.ts"
import type { Tool } from "@olai/ops"
import { siblingsOf, type Row } from "./bundle.ts"
import { currentLogin, mcpTransport, mcpRoute } from "./route.ts"
import { bespokeFrom } from "./tools.ts"
import { type ClientOrConnection, type McpSibling, serveSurfaceAsMcp, type ServedSurfaceMcp } from "@kolu/surface-mcp"
import { hostFaces, hostSurface } from "@olai/surface/host"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { TransportSurface } from "@olai/plugin-api/transport"
import { Effect, type Scope } from "effect"

type Roster = Record<string, McpSibling<SurfaceSpec>>

const signatureOf = (roster: Roster): string =>
  Object.entries(roster).map(([key, one]) =>
    `${key}:${Object.keys(one.tools ?? {}).sort().join(",")}`).sort().join("|")

const applyingRoster = (served: Roster, reroster: (next: Roster) => Promise<unknown>) => {
  let signature = signatureOf(served)
  let settled: Promise<unknown> = Promise.resolve()
  return (reading: () => Roster): Promise<unknown> => {
    const applying = settled.then(() => {
      const next = reading()
      const now = signatureOf(next)
      if (now === signature) return undefined
      signature = now
      return reroster(next)
    })
    settled = applying.catch(() => undefined)
    return applying
  }
}

export const endpoint = (shared: TransportSurface, policy: AgentBinding) => Effect.gen(function*() {
  const transport = mcpTransport()
  const rows = (): ReadonlyArray<Row> => shared.agentRows() as unknown as ReadonlyArray<Row>
  const bundle = (): Roster => siblingsOf(rows(), row =>
    bespokeFrom(row.name, row.tools as ReadonlyArray<Tool>, rows, {
      ...policy, get root() { return policy.root }, login: currentLogin, doorAt: policy.doorAt,
    }))
  const booted = bundle()
  const served = yield* serveFace({ siblings: booted, client: policy.client, rows, transport })
  const applyRoster = applyingRoster(booted, next => served.reroster(next))
  yield* Effect.acquireRelease(
    Effect.sync(() => shared.agentRosterMoved(() => {
      applyRoster(bundle).catch((thrown: unknown) => {
        Effect.runFork(Effect.logWarning(`mcp: the agent face kept its previous roster — ${String(thrown)}`))
      })
    })),
    stop => Effect.sync(stop),
  )
  yield* Effect.promise(() => applyRoster(bundle))
  yield* shared.register({ routes: mcpRoute({ transport, token: shared.token, who: shared.who }) })
})

export const SERVER_INFO = { name: "olai", version: "0.1.0" } as const

/**
 * MCP has no `instructions_changed`: a host already connected keeps the text
 * `initialize` handed it and re-reads only its tool list, on `list_changed`.
 * opencode fetches `instructions` and drops them (anomalyco/opencode#7373).
 */
const INSTRUCTIONS =
  "olai serves a directory of outlines and the documents beside them. Everything here " +
  "is NODES and whole FILES, never bytes: search and read to find a node, then use " +
  "the write tools to change it; list and read a `.md` document by path, and write one " +
  "back whole; `trash_empty` empties `_olai/Trash.olai`'s records; and `files_delete` " +
  "removes a document or an emptied outline — guarded, and not to be put back, so a " +
  "path you are not sure of is a refusal you want. There is no filesystem under this " +
  "— no shell, no grep, no path outside the served directory, and no way to name part " +
  "of a file — and that is deliberate.\n\n" +
  "An address is the app's own — there is no host or port to know: `/#<id>` names a " +
  "node to reveal in its outline; `/zoom/#<id>` opens its standalone page. `/<path>` names a document or an outline, `/<path>#<element>` a " +
  "row of that outline or a heading of that document. A tool's `at` (`#a1b2c3`, " +
  "`notes/plan.md`) is the same address without the leading `/`. Tools are named " +
  "`<row>_<verb>`; a row that is off has no verbs here, and a verb you do not see is " +
  "simply not available."

export const instructionsFor = (rows: ReadonlyArray<Row>): string =>
  [INSTRUCTIONS, ...rows.map(row => row.charter).filter((one): one is string => one !== undefined && one !== "")].join("\n\n")

const AGENT_CORE = { surface: hostSurface, expose: hostFaces.agent } as const

export interface FaceOptions {
  readonly siblings: Roster
  readonly client: () => ClientOrConnection | Promise<ClientOrConnection>
  readonly rows: () => ReadonlyArray<Row>
  readonly transport?: Transport
}

export const serveFace = (
  options: FaceOptions,
): Effect.Effect<ServedSurfaceMcp, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.promise(() =>
      serveSurfaceAsMcp({
        core: AGENT_CORE,
        surfaces: options.siblings,
        client: options.client,
        serverInfo: SERVER_INFO,
        instructions: () => instructionsFor(options.rows()),
        ...(options.transport === undefined ? {} : { transport: options.transport }),
      })
    ),
    (served) => Effect.promise(() => served.close()),
  )
