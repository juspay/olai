/**
 * THE ROSTER, AS A ROOTED BUNDLE — one client per standing row, and the lookup
 * that says which row answers a member.
 *
 * ## What this replaced
 *
 * A flat `mcpContract`: one `defineSurface` copying members out of six rows
 * into one un-prefixed namespace, with a hand-written `MCP` expose map beside
 * it in `@olai/bundle`. It existed because `serveSurfaceAsMcp` took ONE
 * surface, ONE client and ONE `ExposeMap`, and built every `surface://` URI out
 * of that single spec's member keys — so a face spanning six rows had to hand
 * the adapter something shaped like one surface, and the copying was the price.
 *
 * juspay/kolu#2234 took the price away. The adapter takes a rooted bundle now —
 * a bare core beside a keyed set of siblings, exactly the shape
 * `implementRootedSurfaces` serves and `connectSurfaces` consumes — resolves
 * each row's expose map against that ROW's own spec, and mints
 * `surface://collections/markdown/documents` from the key the row was mounted
 * under. Nothing is copied, nothing is curated, and two rows exposing the same
 * member key are disjoint by construction rather than by somebody noticing.
 *
 * ## Nothing here names a row
 *
 * The bundle is built from whatever `TransportSurface.agentRows` says is
 * standing, and each row brings its own `resources` map from its own package.
 * {@link ownerIn} finds who answers a member by walking that row's spec, which
 * is the one question a face over several rows has that a face over one does
 * not. A table saying "`ops.node` is outlines'" would be #546's finding again,
 * one seam further out.
 */
import { buildSurfaceFace, type RootedSurfaceClients, type SurfaceClientCallable } from "@kolu/surface/client"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import type { ExposeMap } from "@kolu/surface/expose"
import type { BespokeTool, McpSibling } from "@kolu/surface-mcp"
import { scopedTo, type Reading } from "./live-client.ts"
import type { writerAt } from "./authority.ts"

/** One standing row, as this face reads it off `TransportSurface.agentRows`. */
export interface Row {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly resources: Readonly<Record<string, unknown>>
  readonly tools: ReadonlyArray<unknown>
}

type Spec = {
  readonly cells?: Readonly<Record<string, unknown>>
  readonly collections?: Readonly<Record<string, unknown>>
  readonly streams?: Readonly<Record<string, unknown>>
  readonly procedures?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

/** Whether a row's OWN spec declares this member — and, for a procedure group,
 *  this verb of it. The four kinds are walked separately because only
 *  procedures nest: a cell's verbs are the framework's (`get`), a collection's
 *  are `keys`/`get`/`deltas`, and neither appears in the spec. */
const declares = (spec: unknown, member: string, verb: string): boolean => {
  const it = spec as Spec
  if (it.procedures?.[member] !== undefined) return it.procedures[member]![verb] !== undefined
  return it.cells?.[member] !== undefined || it.collections?.[member] !== undefined || it.streams?.[member] !== undefined
}

/**
 * WHICH STANDING ROW ANSWERS `<member>.<verb>` — or nobody.
 *
 * Derived rather than written down, which is the point: a member's owner is a
 * fact about that row's spec, the row is in the process, and a second statement
 * of it here could only be a copy that goes stale. `undefined` is the honest
 * answer while a row is off, and the door turns it into the same refusal an
 * absent capability gets.
 *
 * `ops.run` IS THE ONE MEMBER SEVERAL ROWS DECLARE — outlines, markdown, files
 * and trash each answer their own ops — so "who runs this" is a question about
 * the REQUEST rather than about the member. {@link runnerIn} settles it.
 */
export const ownerIn = (rows: ReadonlyArray<Row>, member: string, verb: string): string | undefined =>
  rows.find(row => declares(row.surface.spec, member, verb))?.name

/**
 * WHICH ROW RUNS THIS `op` — read off the WRITE TOOLS the rows brought.
 *
 * A row that contributes `outlines_title` is by construction the row that answers
 * `title`: the tool is `write("outlines_title", …, { op: "title" })` in that row's
 * own package, beside the `dispatch` const that claims the same case. So the
 * op-to-owner table this face needs is already assembled by the time the tools
 * are, and there is nothing to type.
 *
 * This IS the dispatch envelope `@olai/server`'s `composition.ts` used to run,
 * and #546's finding was right that it would have to reappear somewhere. What
 * changed is where it is written: not as a central claim about six rows, but as
 * a reading of what each standing row brought with it.
 */
export const runnerIn = (rows: ReadonlyArray<Row>): ReadonlyMap<string, string> => {
  const owners = new Map<string, string>()
  for (const row of rows) {
    for (const tool of row.tools) {
      const it = tool as { readonly kind?: string; readonly fixed?: Readonly<Record<string, unknown>> }
      const op = it.kind === "write" ? it.fixed?.["op"] : undefined
      if (typeof op === "string" && !owners.has(op)) owners.set(op, row.name)
    }
  }
  return owners
}

/**
 * THE SIBLING HALF OF THE BUNDLE — one entry per standing row, keyed by the
 * segment its URIs take and the word its argv takes.
 *
 * EVERY row, not only the ones with a resource: a row's `tools` ride the same
 * entry, and that is what makes a verb leave with the row that brought it.
 * `expose: {}` is the ordinary answer for most of them — most rows' whole agent
 * face is verbs, and a resource is an ADDRESS, which only a member worth
 * subscribing to needs.
 *
 * A row's tools keep the names they were AUTHORED with. kolu takes the sibling
 * segment on DERIVED names only (juspay/kolu#2234): a member key is chosen
 * inside one spec with no view of the others, so two rows declaring `entries`
 * is a collision nobody could foresee and the prefix is what makes it
 * impossible — while a tool name is chosen with the whole product in view, is
 * the vocabulary that appears in agent prompts and in docs, and must not move
 * when the composition does. Ownership rides the entry instead, so the verb
 * still withdraws with its row.
 */
export const siblingsOf = (
  rows: ReadonlyArray<Row>,
  verbs: (row: Row) => Record<string, BespokeTool>,
): Record<string, McpSibling<SurfaceSpec>> =>
  Object.fromEntries(rows.map(row => [row.name, {
    surface: row.surface as Surface<SurfaceSpec>,
    expose: row.resources as ExposeMap<SurfaceSpec>,
    tools: verbs(row),
  }] as const))

/**
 * ...AND THE CLIENT HALF, minted fresh for the roster it is asked about.
 *
 * ONE CLIENT PER SIBLING, each built against that row's OWN standalone spec and
 * dispatched through {@link scopedTo}, so the face itself never learns it is
 * scoped — kolu's own words for the arrangement, and its `scopeSiblingTag` is
 * what does the rewriting. A row that has LEFT is simply absent from `clients`,
 * which is what makes a call to its members refusable rather than silently
 * unresolved.
 *
 * NO CORE. Core's four members — the plugin roster, its switch, who is looking,
 * what this deployment is called — are on no agent face: `hostFaces.agent` is
 * `{}`, and each of them is a paint instruction for a person or a decision a
 * person makes. So this bundle is siblings alone, which kolu accepts (a bundle
 * with NEITHER half is what it refuses).
 */
export const clientsFor = (
  rows: ReadonlyArray<Row>,
  read: Reading,
  caller: Parameters<typeof writerAt>[1],
): RootedSurfaceClients => ({
  clients: Object.fromEntries(rows.map(row => [
    row.name,
    buildSurfaceFace(row.surface as Surface<SurfaceSpec>, scopedTo(read, caller, row.name)) as SurfaceClientCallable,
  ])),
})
