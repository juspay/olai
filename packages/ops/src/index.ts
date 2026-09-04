/**
 * @olai/ops — the only writer, and the only reader an agent gets.
 *
 * It sits between `@olai/format` (what a record is, and what is legal) and
 * `@olai/store` (how bytes become durable), and it is where an EDIT lives:
 * "mark this done", "put this under that", "archive this". Nothing above it —
 * the surface, the chat panel, the MCP tools — knows how a write is made; they
 * name an op and read the answer.
 *
 * FOUR things come out of here, and each is one socket rather than the wires
 * behind it:
 *
 *   - `codec` — the joint between the format and the store. It is here because
 *     this is the layer that holds both, and because the write gate validates
 *     through it on every commit;
 *   - `make` — the ops service: one `run` that plans, writes and retries, plus
 *     `commit` / `push` / `resume` through a ledger door the git plugin stands
 *     behind (or refuse in words when nobody does). The planner behind `run`
 *     is deliberately NOT exported: it is the inside of this one, and its own
 *     tests reach it directly;
 *   - `Query` — how a reader that is not a browser sees the set, over parsed
 *     nodes and never over bytes;
 *   - `TOOLS` — the closed list of what an agent may do, each entry carrying
 *     its own schema and, for a read, its own reader.
 *
 * The table was private while this package also owned an MCP server (`Mcp`,
 * a hand-rolled JSON-RPC dispatch): what a consumer wanted then was the server,
 * and the list was what the server was made of. `@kolu/surface-mcp` is the
 * server now, so the list is what a consumer wants — and the projection onto MCP
 * moved up to `@olai/server`, which keeps the SDK out of this layer's dependency
 * closure. An op still does not know it is being called over a wire.
 */

export { codecFor } from "./codec.ts"
export type { Store } from "./deps.ts"
export { type Caller, type Fence, type Outside, outsideFence } from "./fenced.ts"
export { make, type Ledger, type Ops, type Options } from "./ops.ts"
/** The two refusals a caller ABOVE this layer meets too, about an id: one the
 *  set does not declare, and one that names a PLACEMENT rather than a node.
 *  Exported so the keystroke resolver and the chat context resolver in
 *  `@olai/server` say what a tool call says. */
export { notANode, notFound, noSuchDocument } from "./refusals.ts"
export { fenceRefusal } from "./refusals.ts"
/** What a `merge` WOULD DO — which row it joins, which branch that row adopts,
 *  and the two texts it ends up with. The keystroke resolver needs all three to
 *  say what would take a merge BACK, and one spelling is what keeps an undo from
 *  naming the row above the one it meant, putting a branch back in a different
 *  order, or carrying a guard that stopped matching. */
export { type Merging, merging } from "./plan.ts"

/** The write vocabulary, under the names this layer's own answers use. It
 *  lives on the FLOOR (`@olai/format`'s `writing.ts`, which says why): the
 *  surface carries these to an agent's door, so a package the browser bundles
 *  and a package that holds a store both need them. Two names differ and the
 *  aliasing is `committing.ts`'s precedent — `WriteRequest` is `Request` to a
 *  layer that knows exactly one kind, and `WriteResult` is the `Applied` every
 *  caller of `run` already speaks. */
export { WriteRequest as Request, type WriteResult as Applied } from "@olai/format"
export {
  type Acting,
  type Asking,
  type Planning,
  type Running,
  type Tool,
  TOOLS,
} from "./tools.ts"

export * as Query from "./query.ts"
