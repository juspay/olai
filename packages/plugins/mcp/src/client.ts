/**
 * THE FLAT CONTRACT THIS FACE IS TYPED AGAINST, and the map from each of its
 * members to the ROW that answers it.
 *
 * ## Why a flat contract is still here after #546
 *
 * Every member on the wire carries its owner now — `surface/outlines/ops/node`,
 * `surface/markdown/ops/document` — and this file is the one place in the tree
 * that still speaks the bare names. It is not a leftover: `serveSurfaceAsMcp`
 * takes ONE `Surface`, ONE client and ONE `ExposeMap`, and builds every
 * `surface://` URI out of that single spec's member KEYS. A rooted bundle has
 * nowhere to go in it — juspay/kolu#2233 is the ask, and until it lands a face
 * spanning six rows has to hand the adapter a spec that looks like one surface.
 *
 * SO THE FLATNESS IS CONFINED TO THE TYPES, and the DISPATCH underneath is
 * scoped. {@link ownerIn} reads each standing row's own spec to find who
 * declares a member, `./live-client.ts` rewrites the tag through kolu's own
 * `scopeSiblingTag`, and no member is reachable that its owner is not currently
 * serving. Nothing here decides POLICY — which row owns what is read off the
 * rows, never typed here — so this contract cannot drift from the roster the
 * way `@olai/bundle`'s hand-written face table could.
 *
 * WHAT GOES WHEN kolu#2233 LANDS: this whole module. The adapter takes the
 * rooted bundle, the URIs become `surface://collections/markdown/documents`,
 * and the roster it advertises moves with `list_changed`.
 */
import { defineSurface } from "@kolu/surface/define"
import { clientOn as on, clientOver as over, type SurfaceClient } from "@olai/surface/client"
import type { SurfaceDispatch } from "@kolu/surface/link"
import type { ExposeMap } from "@kolu/surface/expose"
import { surface as outlines } from "olai-plugin-outlines/surface"
import { surface as markdown } from "olai-plugin-markdown/surface"
import { surface as files } from "olai-plugin-files/surface"
import { surface as search } from "olai-plugin-search/surface"
import { surface as definitions } from "olai-plugin-vault-plugins/surface"
import { surface as vault } from "olai-plugin-vault/surface"
export const mcpContract = defineSurface({
  collections: { outlines: outlines.spec.collections.outlines, documents: markdown.spec.collections.documents },
  cells: { errors: vault.spec.cells.errors },
  procedures: {
    search: search.spec.procedures.search,
    plugins: definitions.spec.procedures.plugins,
    ops: { ...outlines.spec.procedures.ops, ...markdown.spec.procedures.ops, ...files.spec.procedures.ops },
  },
})
/**
 * WHAT AN AGENT MAY SEE OF IT — the three resources, spelled once.
 *
 * It was `@olai/bundle`'s `MCP`, one of the three hand-written face tables
 * #546 deleted, and it moved here rather than into the rows because it is not a
 * per-row grant: it is the `ExposeMap` {@link mcpContract} is resolved with, and
 * the adapter needs the member KIND to turn a key into a `surface://` URI. The
 * rows' own `faces.agent` maps are what decide whether an agent may REACH each
 * of them; this says which of them are published as resources at all.
 *
 * Two readers, one statement: `./binding.ts` serves it, and `olai surface`
 * resolves the same map to know which URIs to read (`@olai/server`'s
 * `dial.ts`). A member on one and not the other would be a resource the CLI
 * could not name or one it named into nothing.
 *
 * The full argument for WHICH members — the O(1)-ish rule, why `manifest` is
 * absent and stays absent — is in the rows that own them, beside the members.
 */
export const AGENT_EXPOSE: ExposeMap<typeof mcpContract.spec> = {
  outlines: "resource",
  documents: "resource",
  errors: "resource",
}

export type McpClient = SurfaceClient<typeof mcpContract.spec>
export const clientOn = (dispatch: SurfaceDispatch): McpClient => on(mcpContract, dispatch)

export const clientOver = (bound: Parameters<typeof over>[1], face: Parameters<typeof over>[2]): McpClient => over(mcpContract, bound, face)

/** One standing row, as this face reads it off `TransportSurface.agentRows`. */
export interface Row {
  readonly name: string
  readonly surface: { readonly spec: unknown }
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
 * WHICH STANDING ROW ANSWERS `surface/<member>/<verb>` — or nobody.
 *
 * Derived from the rows themselves rather than written down, which is the whole
 * point: a member's owner is a fact about that row's spec, and the row is in
 * the process, so a second statement of it here could only be a copy that goes
 * stale. `undefined` is the honest answer while a row is off, and it is what
 * `./live-client.ts` turns into the same refusal an unexposed tag gets.
 *
 * `ops.run` IS THE ONE MEMBER FOUR ROWS DECLARE, and this function cannot
 * settle it — outlines, markdown, files and trash each answer their own ops, so
 * "who runs this" is a question about the REQUEST rather than about the tag.
 * {@link runnerIn} settles it, off the same rows.
 */
export const ownerIn = (rows: ReadonlyArray<Row>, member: string, verb: string): string | undefined =>
  rows.find(row => declares(row.surface.spec, member, verb))?.name

/**
 * WHICH ROW RUNS THIS `op` — read off the WRITE TOOLS the rows brought.
 *
 * A row that contributes `set_title` is by construction the row that answers
 * `title`: the tool is `write("set_title", …, { op: "title" })` in that row's
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
