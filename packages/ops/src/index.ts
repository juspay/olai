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
 *     `pending` and `commit`, which are what a write WAITS for now that a
 *     commit is something somebody asks for. The planner behind `run`, and the
 *     git plumbing behind the other two, are deliberately NOT exported: they
 *     are the inside of this one, and their own tests reach them directly;
 *   - `Query` — how a reader that is not a browser sees the set, over parsed
 *     nodes and never over bytes;
 *   - `Mcp` — those two spoken as tools, with no transport in it. The tool
 *     TABLE is not exported either: what a consumer wants is the server, and
 *     the list is what the server is made of.
 */

export { codec } from "./codec.ts"
export type { Store } from "./deps.ts"
export { make, type Ops, type Options } from "./ops.ts"
export { type Applied, Request } from "./request.ts"

export * as Mcp from "./mcp.ts"
export * as Query from "./query.ts"
