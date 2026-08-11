/**
 * The ops layer's tool table, projected onto `@kolu/surface-mcp`'s vocabulary.
 *
 * `@olai/ops` declares WHAT an agent may do — one table, each entry carrying its
 * name, title, description, request schema, and (for a read) its own reader.
 * This file says how that reaches an MCP host. One declaration, two uses, no
 * second list: the table stays the single place a tool is described, and
 * everything below is mechanical.
 *
 * **Why this lives in `@olai/server` and not beside the table.** It used to:
 * `@olai/ops/src/mcp.ts` was the dispatch, deliberately SDK-free, and the table
 * was kept unexported because "what a consumer wants is the server, and the list
 * is what the server is made of". Both halves of that stopped being true at
 * once. The server is the framework's now, so what a consumer wants IS the list;
 * and the framework brings the MCP SDK, which would put express, hono and ajv in
 * the dependency closure of a package whose own manifest says it knows "nothing
 * about a listener, a socket or a browser". The ops layer goes back to being
 * that. The wire vocabulary lives with the two faces that speak it.
 *
 * Three things the projection has to get right, and each is a place the old
 * hand-rolled dispatch had a matching line:
 *
 *   - **The fixed field never reaches the agent.** `set_done` IS `op: "done"`,
 *     so an agent asked to supply it would be filling in a field with one legal
 *     value. The old dispatch compiled the whole request schema and then deleted
 *     those properties out of the JSON Schema; this subtracts them from the
 *     SCHEMA instead ({@link argsOf}), which is the same subtraction one step
 *     earlier and strictly better — what the adapter advertises and what it
 *     decodes against are now the same object, rather than two things that agree.
 *   - **A refusal is an answer.** It comes back as `isError` WITH its structured
 *     detail, so "these three children are not done" is data the agent can act
 *     on rather than a sentence it has to parse. That is what `ToolFailure`
 *     is for (juspay/kolu#2155), and it is the reason this migration waited.
 *   - **A read is a read.** `mutates: false` is a conscious opt-in to the
 *     auto-approvable hint, and it is correct for the four query tools and for
 *     nothing else.
 */

import { kindOf, type OpFailure } from "@olai/format"
import { type Ops, type Reading, type Tool } from "@olai/ops"
import { type BespokeTool, ToolFailure, type ToolInputSchema } from "@kolu/surface-mcp"
import { Effect, Schema } from "effect"

import type { Request } from "@olai/ops"

/**
 * Every tool in the table, as bespoke MCP tools over `ops`.
 *
 * Takes the table rather than reaching for it so the one place it is imported
 * from is the composition root, and so a test can project a subset without a
 * module mock.
 */
export const bespokeFrom = (
  tools: ReadonlyArray<Tool>,
  ops: Ops,
): Record<string, BespokeTool> =>
  Object.fromEntries(tools.map((tool) => [tool.name, bespoke(tool, ops)]))

const bespoke = (tool: Tool, ops: Ops): BespokeTool => ({
  // Omitted rather than passed as `undefined` when the tool takes nothing —
  // see {@link argsOf}. An absent `input` is what the adapter reads as "no
  // arguments"; a present-but-empty schema is a different claim.
  ...(argsOf(tool) === undefined ? {} : { input: argsOf(tool) }),
  title: tool.title,
  description: tool.description,
  // Conservative where it matters and honest where it does not: only the four
  // query tools are read-only, and `readOnlyHint` is what can let a host run a
  // call unconfirmed. Everything else is left mutating.
  mutates: tool.kind === "write",
  handler: (args) => answer(tool, ops, args),
})

/**
 * What an agent fills in: the request schema minus the fields the tool's NAME
 * already decides, or `undefined` for a tool that takes nothing at all.
 *
 * A write's schema carries its `op` discriminator, which is exactly one value
 * for this tool — so it comes out here, once, and the handler puts it back.
 * Reaching for `.fields` is how a `Schema.Struct` is taken apart in Effect 4;
 * there is no `Schema.omit` at this pin. Field-level annotations ride on the
 * field schemas, so the descriptions an agent reads survive the rebuild.
 *
 * **An empty field set becomes `undefined`, and must.** Effect compiles
 * `Schema.Struct({})` to `anyOf: [object, array]` rather than to an object
 * type, so the adapter's "is this an object?" test says no and advertises the
 * input WRAPPED under a single `value` property — after which dispatch unwraps
 * `args.value`, finds nothing, and every call of a no-argument tool is refused
 * with "Expected object | array". `list_outlines` is that tool, and it is the
 * first call an agent makes. An absent `input` is the honest spelling anyway: a
 * tool that takes nothing has no argument schema, and the adapter advertises it
 * as the empty object MCP wants.
 */
const argsOf = (tool: Tool): ToolInputSchema<unknown> | undefined => {
  const fields = { ...(tool.schema as unknown as { fields: Schema.Struct.Fields }).fields }
  if (tool.kind === "write") {
    for (const fixed of Object.keys(tool.fixed)) delete fields[fixed]
  }
  if (Object.keys(fields).length === 0) return undefined
  return (tool.kind === "read"
    ? tool.schema
    : Schema.Struct(fields)) as unknown as ToolInputSchema<unknown>
}

/**
 * Run one call.
 *
 * The two arms differ in what they carry rather than in a flag, exactly as the
 * table does: a READ answers from a snapshot through the reader the table holds
 * beside it — so a tool the table declares and nothing answers is a type error
 * — and a WRITE goes through `ops.run`, which plans, commits and retries.
 *
 * Both map an `OpFailure` onto {@link refusal}. Nothing else is caught: a defect
 * is a defect, and dressing one up as a refusal would tell an agent to try
 * something else about a condition that is not its fault.
 */
const answer = (
  tool: Tool,
  ops: Ops,
  args: unknown,
): Effect.Effect<unknown, ToolFailure> =>
  Effect.mapError(
    tool.kind === "write"
      // The `op` the name decides, put back — see {@link argsOf}. Already
      // decoded by the adapter against the schema this tool advertised, so
      // there is nothing left to validate.
      ? Effect.map(
        ops.run({ ...(args as object), ...tool.fixed } as Request),
        (applied) => ({ ...applied, did: tool.name }),
      )
      : Effect.map(ops.read, (at: Reading) => tool.read(at, args as never)),
    (failure: OpFailure) => refusal(tool.name, failure),
  )

/**
 * A refusal, in the two halves a refusal has.
 *
 * `message` is the sentence the model reads; `detail` is the data the caller
 * acts on, and only the raiser knows both. The kind is spelled into both — into
 * the prose because a model reading only the text should still know what class
 * of "no" this was, and into the detail because that is what a caller asserts
 * on.
 */
const refusal = (name: string, failure: OpFailure): ToolFailure =>
  new ToolFailure(
    `\`${name}\` was refused (${kindOf(failure)}): ${failure.message}`,
    { kind: kindOf(failure), ...(failure.toJSON() as Record<string, unknown>) },
  )
