/**
 * @olai/ops — the only writer, and the only reader an agent gets.
 *
 * It sits between `@olai/format` (what a record is, and what is legal) and
 * `@olai/store` (how bytes become durable), and it is where an EDIT lives:
 * "mark this done", "put this under that", "archive this". Nothing above it —
 * the surface, the chat panel, the MCP tools — knows how a write is made; they
 * name an op and read the answer.
 *
 * Four things come out of here:
 *
 *   - `make`, the ops service: one `run` that plans, commits and retries;
 *   - `plan`, the pure decision behind it, exported because it is the part
 *     worth testing directly;
 *   - the query functions, which is how a reader that is not a browser sees
 *     the set — over parsed nodes, never over bytes;
 *   - `Mcp`, the tool surface those two are spoken through.
 *
 * The `codec` that joins `@olai/format` to `@olai/store` is here too: it is
 * the same joint this package is built on, and the write gate validates
 * through it on every commit.
 */

export { codec } from "./codec.ts"
export type { Store } from "./deps.ts"
export { make, type Ops, type Options } from "./ops.ts"
export { type Context, type FilePlan, plan, type Plan } from "./plan.ts"
export {
  AddRequest,
  type Applied,
  ArchiveRequest,
  DateRequest,
  DescRequest,
  MarkRequest,
  MoveRequest,
  Request,
  TitleRequest,
} from "./request.ts"

export * as Query from "./query.ts"
export * as Mcp from "./mcp.ts"
export * as Git from "./git.ts"
export { TOOLS, type Tool, toolNamed } from "./tools.ts"
