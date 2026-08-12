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
/** When writes reach git, and what git is doing for the directory they reach.
 *  The mode is passed IN and the state comes back OUT; the subprocesses between
 *  them are this layer's business. */
export { COMMIT_MODES, type CommitMode, type GitState } from "./pending.ts"
export { type Applied, Request } from "./request.ts"
export { type Reading, type Tool, TOOLS, toolNamed } from "./tools.ts"

export * as Query from "./query.ts"
