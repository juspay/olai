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
 *     auto-approvable hint, and it is correct for the six query tools and for
 *     nothing else.
 */

import { isOpFailure, kindOf, type OpFailure, type Writer } from "@olai/format"
import { type Acting, type Asking, type Running, type Tool } from "@olai/ops"
import { type BespokeTool, ToolFailure, type ToolInputSchema } from "@kolu/surface-mcp"
import { Effect, Schema } from "effect"

import type { Request } from "@olai/ops"
import type { OlaiSurfaceClient } from "./face.ts"

/** The three ops-layer doors a tool call needs, together. `@olai/ops` names
 *  them one per tool arm; nothing but this projection ever wants all three, so
 *  the union is spelled here rather than exported as a fourth name upstream. */
type Door = Running & Asking & Acting

/**
 * Every tool in the table, as bespoke MCP tools over the SURFACE.
 *
 * Takes the table rather than reaching for it so the one place it is imported
 * from is the composition root, and so a test can project a subset without a
 * module mock.
 *
 * **It takes no ops layer, and that is the change this file exists to record.**
 * A tool used to be a closure over a local `Ops`, which meant an MCP face could
 * only exist in a process holding the store. Now every arm lands on a
 * surface procedure, and the client that carries it is handed in per call by
 * the adapter: a direct dispatch in the process that holds the store. One
 * path — not a second olai kept beside the first that could answer differently.
 *
 * **And it takes no writer either.** It used to: `chat-agent` for the panel's
 * agent, `mcp` for somebody's own. That is still exactly the distinction the
 * `X-Olai-Writer` trailer records, and it is still decided by a composition
 * root — but by the one that composes the FACE these tools reach through
 * (`../runtime.ts`'s `writerAt`), which is where every other fact about a face
 * is decided. A tool that could name a writer could name the wrong one, and
 * this projection now has no way to name any.
 */
export const bespokeFrom = (
  tools: ReadonlyArray<Tool>,
): Record<string, BespokeTool> =>
  Object.fromEntries(tools.map((tool) => [tool.name, bespoke(tool)]))

/**
 * The surface, as the three doors `@olai/ops`' arms are declared against.
 *
 * Every line is one procedure call and there is nothing else to it — which is
 * the property worth having: the ops layer's own implementation of these
 * interfaces and this one answer the same questions, so a tool cannot behave
 * differently for being reached over a socket.
 *
 * `commit`, `push` and `search` are the members BOTH doors call (`git.*`,
 * `search.nodes`); the rest are the agent's own `ops.*`, the two document
 * reads included — a browser draws a `.md` off the `documents` COLLECTION it
 * already subscribes to, which is a different question from the listing an
 * agent asks. Which writer a landing write is recorded as is neither's
 * business — the FACE this client dispatches at decided it (`../runtime.ts`'s
 * `writerAt`).
 *
 * ONE PER CLIENT, not one per call. Three of the nine lines are Effect VALUES
 * rather than thunks (`push`, `outlines`, `documents` — that is the shape the
 * interfaces declare, because a question with no argument is a value), so
 * building a door per tool call would decode `git.push`'s empty input on every
 * `set_done` as well. The adapter hands back the same client object for a
 * connection's whole life, so the key is the connection in everything but
 * name — and an Effect is an immutable description, so reuse across calls is
 * what it is for.
 */
const doorFor = (client: OlaiSurfaceClient): Door => {
  const held = DOORS.get(client)
  if (held !== undefined) return held
  const door = doorOver(client)
  DOORS.set(client, door)
  return door
}

const DOORS = new WeakMap<OlaiSurfaceClient, Door>()

const doorOver = (client: OlaiSurfaceClient): Door => ({
  run: (request) => landed(client.surface.ops.run(request)),
  // The act arm has NO failure channel and says so by type: every way a commit
  // or a push can go wrong is a value the caller is entitled to see, carried on
  // the answer. So the only thing left for these two to fail with is the
  // transport, and `orDie` is {@link landed}'s rule with nothing to spare.
  commit: (request) => Effect.orDie(client.surface.git.commit(request)),
  push: Effect.orDie(client.surface.git.push({})),
  outlines: landed(client.surface.ops.outlines(undefined)),
  node: (request) => landed(client.surface.ops.node(request)),
  subtree: (request) => landed(client.surface.ops.subtree(request)),
  search: (request) => landed(client.surface.search.nodes(request)),
  documents: landed(client.surface.ops.documents(undefined)),
  document: (request) => landed(client.surface.ops.document(request)),
})

/**
 * A member call, narrowed back to the failures the ops layer declares.
 *
 * Every call over a surface carries the framework's transport failure channel
 * on top of the member's own — the socket died, the protocol could not decode —
 * and the ops-layer interfaces do not have an arm for that, correctly: a
 * transport death is not a refusal. It is a DEFECT here for the same reason
 * {@link answer} catches nothing but `OpFailure`: dressing one up as a refusal
 * would tell an agent to try something else about a condition that is not its
 * fault, and the one thing an agent could do about a dead socket — dial again —
 * the adapter already does for it before this is ever reached.
 */
const landed = <A>(call: Effect.Effect<A, unknown>): Effect.Effect<A, OpFailure> =>
  Effect.catch(
    call,
    (failure) => isOpFailure(failure) ? Effect.fail(failure) : Effect.die(failure),
  )

const bespoke = (tool: Tool): BespokeTool => {
  // Built ONCE — it compiles a `Schema.Struct` — and read twice below, which is
  // what the test for it is asking about.
  const input = argsOf(tool)
  return {
    // Omitted rather than passed as `undefined` when the tool takes nothing —
    // see {@link argsOf}. An absent `input` is what the adapter reads as "no
    // arguments"; a present-but-empty schema is a different claim.
    ...(input === undefined ? {} : { input }),
    title: tool.title,
    description: tool.description,
    // Conservative where it matters and honest where it does not: only the four
    // query tools are read-only, and `readOnlyHint` is what can let a host run a
    // call unconfirmed. Everything else is left mutating.
    mutates: tool.kind !== "read",
    // The client the ADAPTER holds, not one this projection closed over — so a
    // socket that dropped and was re-dialled is answered by the fresh one, and
    // the tool surface never has to be rebuilt. Typed at this one seam, where
    // `./face.ts` already keeps the framework-forced structural cast.
    handler: (args, client) => answer(tool, doorFor(client as OlaiSurfaceClient), args),
  }
}

/**
 * What an agent fills in: the request schema minus the fields the tool's NAME
 * already decides, or `undefined` for a tool that takes nothing at all.
 *
 * A write's schema carries its `op` discriminator, which is exactly one value
 * for this tool — so it comes out here, once, and the handler puts it back.
 * Reaching for `.fields` is how a `Schema.Struct` is taken apart in Effect 4;
 * there is no `Schema.omit` at this pin, and the table's own declaration says
 * every tool's schema IS a struct, so this reads them rather than asserting
 * them. Field-level annotations ride on the field schemas, so the descriptions
 * an agent reads survive the rebuild.
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
  const fields = { ...tool.schema.fields }
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
 * The three arms differ in what they carry rather than in a flag, exactly as the
 * table does: a READ answers from a snapshot through the reader the table holds
 * beside it — so a tool the table declares and nothing answers is a type error;
 * a WRITE goes through `ops.run`, which plans, writes and retries; and an ACT
 * carries its own verb, which is how `commit` reaches the same `Ops.commit` the
 * button does without this file knowing what committing is.
 *
 * All three map an `OpFailure` onto {@link refusal}. Nothing else is caught: a
 * defect is a defect, and dressing one up as a refusal would tell an agent to
 * try something else about a condition that is not its fault. The act arm has no
 * error channel at all — every way `commit` can go wrong is a value a caller is
 * entitled to see — so its mapping is vacuous and says so by type.
 */
const answer = (
  tool: Tool,
  door: Door,
  args: unknown,
): Effect.Effect<unknown, ToolFailure> =>
  Effect.mapError(
    tool.kind === "write"
      // The `op` the name decides, put back — see {@link argsOf}. Already
      // decoded by the adapter against the schema this tool advertised, so
      // there is nothing left to validate.
      ? Effect.map(
        door.run({ ...(args as object), ...tool.fixed } as Request),
        (applied) => ({ ...applied, did: tool.name }),
      )
      : tool.kind === "act"
      ? Effect.map(
        tool.act(door, args as never),
        (result) => ({ ...(result as object), did: tool.name }),
      )
      : tool.ask(door, args as never),
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
