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

/** Read by the catch-up below and by the no-op guard, which must agree or one
 *  of them re-applies what the other just settled. */
const signatureOf = (map: Record<string, { readonly tools?: Record<string, unknown> }>): string =>
  Object.entries(map).map(([key, one]) =>
    `${key}:${Object.keys(one.tools ?? {}).sort().join(",")}`).sort().join("|")

export const endpoint = (shared: TransportSurface, policy: AgentBinding) => Effect.gen(function*() {
  const transport = mcpTransport()
  const rows = (): ReadonlyArray<Row> => shared.agentRows() as unknown as ReadonlyArray<Row>
  const bundle = () => siblingsOf(rows(), row =>
    bespokeFrom(row.name, row.tools as ReadonlyArray<Tool>, rows, {
      ...policy, get root() { return policy.root }, login: currentLogin, doorAt: policy.doorAt,
    }))
  const booted = bundle()
  const served = yield* serveFace({ siblings: booted, client: policy.client, rows, transport })
  // What the chain buys is the two NOTIFICATIONS, which are awaited:
  // un-chained, a burst could tell a host the list changed in an order that
  // does not match the order it changed in.
  let moving: Promise<unknown> = Promise.resolve()
  let applied = signatureOf(booted)
  yield* Effect.acquireRelease(
    Effect.sync(() => shared.agentRosterMoved(() => {
      moving = moving.then(() => {
        const next = bundle()
        const now = signatureOf(next)
        if (now === applied) return undefined
        applied = now
        return served.reroster(next)
      }).catch((thrown: unknown) => {
        Effect.runFork(Effect.logWarning(`mcp: the agent face kept its previous roster — ${String(thrown)}`))
      })
    })),
    stop => Effect.sync(stop),
  )
  yield* Effect.promise(async () => {
    const now = bundle()
    const signature = signatureOf(now)
    if (signature === applied) return
    applied = signature
    await served.reroster(now)
  })
  yield* shared.register({ routes: mcpRoute({ transport, token: shared.token, who: shared.who }) })
})

export const SERVER_INFO = { name: "olai", version: "0.1.0" } as const

/**
 * Served at `initialize`, read per connection: a host ALREADY connected is not
 * told again, because MCP has no `instructions_changed` — only its tool list is
 * re-read, on `list_changed`.
 *
 * The composed whole must stay under 2000 bytes (`@olai/server`'s
 * `profiles.test.ts` holds the boundary): Claude Code truncates server
 * instructions at 2 KB silently, and bills the text on every turn.
 *
 * Codex and Claude Code honour `instructions`; opencode fetches it and drops it
 * (anomalyco/opencode#7373). pi is unverified.
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
  readonly siblings: Record<string, McpSibling<SurfaceSpec>>
  /** It must READ the current roster rather than close over one. */
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
