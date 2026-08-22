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
 *     `pending` and `commit`, which are what a write WAITS for now that a commit
 *     is something somebody asks for, and one `git` saying what git is doing for
 *     the directory at all. The planner behind `run`, and the git plumbing
 *     behind the other three, are deliberately NOT exported: they are the inside
 *     of this one, and their own tests reach them directly;
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

export { codec } from "./codec.ts"
export type { Store } from "./deps.ts"
export { make, type Ops, type Options } from "./ops.ts"
/** The two refusals a caller ABOVE this layer meets too, about an id: one the
 *  set does not declare, and one that names a PLACEMENT rather than a node.
 *  Exported so the keystroke resolver and the chat context resolver in
 *  `@olai/server` say what a tool call says. */
export { notANode, notFound, noSuchDocument } from "./refusals.ts"
/** What a `merge` WOULD DO — which row it joins, which branch that row adopts,
 *  and the two texts it ends up with. The keystroke resolver needs all three to
 *  say what would take a merge BACK, and one spelling is what keeps an undo from
 *  naming the row above the one it meant, putting a branch back in a different
 *  order, or carrying a guard that stopped matching. */
export { type Merging, merging } from "./plan.ts"
/** When writes reach git, and what git is doing for the directory they reach.
 *  The POLICY is passed IN — what this server does, and the flags the operator
 *  gave, in `@olai/format`'s own vocabulary — and the state comes back OUT; the
 *  subprocesses between them, and the quiet window over them, are this layer's
 *  business. */
export {
  COMMIT_BUTTON,
  COMMIT_TOOL,
  COMMIT_MODES,
  commitDoor,
  commitDoors,
  type CommitFace,
  type CommitMode,
  fixedPolicy,
  type Policy,
  type Status,
} from "./pending.ts"
/** The quiet window's own rules, for the tests that hold them and for the
 *  sentence a preferences panel prints about the span. */
export { flurryOf, mayRecord, QUIET_MS, type Standing } from "./loop.ts"
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
  type Running,
  type Tool,
  TOOLS,
} from "./tools.ts"

export * as Query from "./query.ts"
