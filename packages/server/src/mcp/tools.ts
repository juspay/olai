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
 *   - **A read carries its age.** Every read's answer gains a `vintage`, from
 *     the store's own read socket at the class an agent's result needs
 *     (`@olai/store`'s `Freshness`). It is here rather than in each tool's
 *     answer schema for the same reason `root` is: it is a fact about the
 *     SERVER that answered, true of every read the same way, and a field
 *     twelve schemas each declare is twelve places for it to go missing. On
 *     2026-08-25 a running server answered `read_node` normally with week-old
 *     truth for half an hour; what was missing was not a tool, it was this.
 */

import { isOpFailure, kindOf, type OpFailure, stampOf, type Writer } from "@olai/format"
import { isStale, type Vintage } from "@olai/store"
import { type Acting, type Applied, type Asking, type Planning, type Running, type Tool } from "@olai/ops"
import { type BespokeTool, ToolFailure, type ToolInputSchema } from "@kolu/surface-mcp"
import { Effect, Result, Schema } from "effect"

import type { Request } from "@olai/ops"
import { resolvedWrite } from "../resolving.ts"
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
 * **It takes the face's IDENTITY, and nothing else about the face.** `capture`
 * records `captured-by` from the identity its door already has, omitting the
 * property when the door has none (ruled, human 2026-08-22) — so this is who
 * the face KNOWS, decided by the composition root that serves it: the login a
 * reverse proxy injected on THIS request, and nobody at all on a direct
 * loopback call or in this process, which is an answer and not a gap. It is a
 * parameter for the same reason the writer once was, and it is bound in the
 * same place — a tool that could name an identity could name the wrong one, and
 * an identity a CALLER could send would not be an attribution at all.
 *
 * **And it takes no writer.** It used to: `chat-agent` for the panel's
 * agent, `mcp` for somebody's own. That is still exactly the distinction the
 * `X-Olai-Writer` trailer records, and it is still decided by a composition
 * root — but by the one that composes the FACE these tools reach through
 * (`../runtime.ts`'s `writerAt`), which is where every other fact about a face
 * is decided. A tool that could name a writer could name the wrong one, and
 * this projection now has no way to name any.
 */
export const bespokeFrom = (
  tools: ReadonlyArray<Tool>,
  at: Served,
): Record<string, BespokeTool> =>
  Object.fromEntries(
    tools.map((
      tool,
    ) => [
      tool.name,
      verb(tool, (args, client) => {
        // BOTH READ HERE, synchronously, on the request's own stack — see
        // `./route.ts`'s `WHOSE` and its sibling storage. Deferring either into
        // the Effect would read whichever request happened to be running when
        // the scheduler got to it: a capture attributed to the wrong person,
        // and a write fenced to the wrong node.
        //
        // AND THIS IS WHY THE FENCE IS A DOOR AND NOT A PROVISION. The adapter
        // evaluates this closure as an ARGUMENT to its request edge and then
        // runs what it returns with `Effect.runPromise` on a FRESH FIBER WITH AN
        // EMPTY CONTEXT, so a service provided anywhere upstream is gone by the
        // time the write gate would read it. This line runs before that, and
        // what it selects is a handler set that already closed over the
        // narrowing — the same thing `../runtime.ts`'s `writerAt` does for the
        // writer, and for the same reason.
        //
        // `doorFor`'s `WeakMap` keys on the client, so each fenced door
        // memoises its own `Door` for free rather than building ten Effects per
        // tool call.
        const said = answer(
          tool,
          doorFor(at.fenced(client as OlaiSurfaceClient)),
          args,
          at.login(),
        )
        if (tool.kind !== "read") return Effect.map(said, (it) => named(it, at.root))
        // THE AGE IS ESTABLISHED FIRST, and that order is the honest one: the
        // look happens, then the read runs against a set that is at least as
        // current as the look proved. The other order would let a publish land
        // between them and stamp an answer with a vintage newer than the answer
        // is. This way the vintage can only understate, which is the direction
        // an agent can act on safely.
        return Effect.flatMap(
          at.vintage,
          (vintage) => Effect.map(said, (it) => named(it, at.root, vintage)),
        )
      }),
    ]),
  )

/** What the FACE knows about itself — the three facts a tool's answer needs
 *  that no caller may supply, and the door it writes through.
 *
 *  `login` is who the door knows (below); `root` is which directory this server
 *  is serving, and it rides every answer out because "which vault answered" was
 *  a question no answer could be asked. It is not a diagnostic nicety: a capture
 *  meant for the human's own vault landed in a checkout's docs directory and the
 *  reply looked exactly like a success, because nothing in it named the place
 *  (2026-08-23). An agent gets it for the same reason a terminal does. */
export interface Served {
  /** The identity this door HAS, or nobody — see the note above.
   *
   *  A THUNK, and read at the top of each handler, because on `/mcp` the answer
   *  is a fact about the REQUEST rather than about the face: the proxy injects a
   *  login per request and two people can be behind one proxy
   *  (`./route.ts`'s `currentLogin`). A face that knows nobody passes
   *  `() => null`, which is a decision said out loud rather than an absence. */
  readonly login: () => string | null
  /** The absolute path of the directory this server is serving. */
  readonly root: string
  /**
   * HOW CURRENT AN ANSWER FROM THIS SERVER IS — the store's read socket, at the
   * class a tool result deserves.
   *
   * An EFFECT and not a value, because it is asked per call: the whole content
   * of a vintage is when it was established, and one taken at composition time
   * would be a number that ages while claiming not to. It cannot fail —
   * `@olai/store`'s read has no failure channel, and a look that could not be
   * taken comes back as an arm of the proof rather than as a defect a tool
   * handler would have to word.
   */
  readonly vintage: Effect.Effect<Vintage>
  /**
   * THE DOOR THIS REQUEST WRITES THROUGH, given the one the adapter holds.
   *
   * Identity for a face nobody fenced — which keeps the adapter's client
   * authoritative and the face's re-dial argument intact. A face that DOES fence
   * answers with the door the composition root composed for this caller
   * (`./tickets.ts`), and a caller can no more name its own fence than it can
   * name its own writer.
   *
   * REQUIRED, with no default, and that is the whole of how a forgotten fence is
   * prevented: `@olai/ops` reads an absent fence as "this door has no session",
   * which is the honest reading for a keystroke and the wrong one for an agent.
   * A face is where every other fact about who is asking is already decided, so
   * it is where a missing answer must be a compile error.
   */
  readonly fenced: (client: OlaiSurfaceClient) => OlaiSurfaceClient
}

/**
 * The SAME table, dispatched to a server instead of answered by one — what
 * `olai surface <verb>` mounts.
 *
 * Every field a caller sees is the field `bespokeFrom` publishes: one name, one
 * input schema, one description, one `mutates`. Only the handler differs, and it
 * differs in the one way that matters — it does not RUN the verb, it CALLS it,
 * as an MCP `tools/call` on the connection the projection handed it. So the verb
 * executes on the server, under the server's own gate, with the server's own
 * identity: a `capture` composed in the calling process could name any
 * `captured-by` it liked, which is precisely what "never caller-set" forbids.
 *
 * The answer comes back already naming the vault's `root` — the server stamped
 * it — and this adds the `url` the caller dialled, which is the half only this
 * side knows: behind a reverse proxy a server cannot tell what address reached
 * it.
 */
export const remoteFrom = (tools: ReadonlyArray<Tool>): Record<string, BespokeTool> =>
  Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      verb(tool, (args, client) => {
        const door = client as unknown as Dialled
        return Effect.map(
          Effect.tryPromise({
            try: () => door.callTool(tool.name, args),
            // The transport's own failures are already the two values the CLI's
            // classifier reads (`../mcpClient.ts`) — a refusal on exit 1 with its
            // structured detail, an unreachable door on exit 3 naming the URL —
            // so they travel untouched rather than being re-worded here.
            catch: (cause) => cause,
          }),
          (said) => at(said, door.url),
        ) as Effect.Effect<unknown, ToolFailure>
      }),
    ]),
  )

/** What `remoteFrom`'s handlers need off the client the projection hands them —
 *  the tool door and the address it was opened on. Declared here, where it is
 *  read, and satisfied by `../dial.ts`'s shim. */
interface Dialled {
  readonly callTool: (name: string, args: unknown) => Promise<unknown>
  readonly url: string
}

/** One row of the table, with its dispatch left open. Both faces build their
 *  verbs through this, so the two cannot drift on what a verb is CALLED, what it
 *  TAKES, or whether it is read-only — only on what calling it does. */
const verb = (
  tool: Tool,
  run: (args: unknown, client: unknown) => Effect.Effect<unknown, ToolFailure>,
): BespokeTool => {
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
    // Conservative where it matters and honest where it does not: only the six
    // query tools are read-only (`list_outlines`, `list_documents`,
    // `read_node`, `read_subtree`, `read_document`, `search_nodes`), and
    // `readOnlyHint` is what can let a host run a call unconfirmed. Everything
    // else is left mutating.
    mutates: tool.kind !== "read",
    // The client the ADAPTER holds, not one this projection closed over — so a
    // socket that dropped and was re-dialled is answered by the fresh one, and
    // the tool surface never has to be rebuilt. Typed at this one seam, where
    // `./face.ts` already keeps the framework-forced structural cast.
    handler: (args, client) => run(args, client),
  }
}

/** The served directory, and — for a read — how old what it says is. An object
 *  answer gains the keys; anything else is left alone rather than wrapped,
 *  because a wrapper would change the shape of an answer to say something about
 *  the server. */
const named = (said: unknown, root: string, vintage?: Vintage): unknown =>
  isRecord(said)
    ? { ...said, root, ...(vintage === undefined ? {} : { vintage: stated(vintage) }) }
    : said

/**
 * THE VINTAGE AS AN AGENT READS IT — the store's value, said in the wire's own
 * vocabulary.
 *
 * Three things an agent can act on and no fourth. `stale` is the bit, and it is
 * first because it is the one an agent must not miss: a set the disk no longer
 * agrees about, or one nobody could check, is not a set to plan a write against.
 * `asOf` and `ageMs` are the same instant said twice on purpose — a timestamp
 * is what a human reading a transcript wants and a duration is what a rule can
 * be written against, and deriving one from the other needs a clock the reader
 * may not share with this process. `proof` says which of the four it is, and
 * carries the one extra fact each arm has: the paths that moved, or the disk's
 * own words for why nobody could look.
 *
 * A projection rather than the store's value passed through, for the reason
 * every wire shape in this tree is one: what `@olai/store` calls its arms is
 * that package's to change, and an agent's transcript is not the place to find
 * out that it did.
 */
const stated = (vintage: Vintage): Record<string, unknown> => ({
  stale: isStale(vintage),
  asOf: new Date(vintage.at).toISOString(),
  ageMs: vintage.age,
  proof: vintage.proof._tag.toLowerCase(),
  ...(vintage.proof._tag === "Diverged" ? { diverged: vintage.proof.paths } : {}),
  ...(vintage.proof._tag === "Unchecked" ? { why: vintage.proof.why } : {}),
})

/** The address this answer was fetched from, on the answer — the client's half
 *  of the same fact. */
const at = (said: unknown, url: string): unknown =>
  isRecord(said) ? { ...said, url } : said

const isRecord = (said: unknown): said is Record<string, unknown> =>
  typeof said === "object" && said !== null && !Array.isArray(said)

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
 * ONE PER CLIENT, not one per call. Four of the ten lines are Effect VALUES
 * rather than thunks (`push`, `outlines`, `paths`, `documents` — that is the
 * shape the interfaces declare, because a question with no argument is a value), so
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
  paths: landed(client.surface.ops.paths(undefined)),
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
  login: string | null,
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
      : tool.kind === "plan"
      ? Effect.map(
        planned(tool, door, args, login),
        (applied) => ({ ...applied, did: tool.name }),
      )
      : tool.ask(door, args as never),
    (failure: OpFailure) => refusal(tool.name, failure),
  )

/**
 * A PLAN arm, run: read the directory, resolve the request against it, write —
 * and resolve ONCE MORE if the write was refused, because the arm may simply
 * have gone stale.
 *
 * THE RACE IS REAL and it is the reason this is not one line. A capture
 * resolves to `create` when the directory has no inbox and `add` when it has
 * one; between the reading and the write, somebody else's capture can mint the
 * very file this one was going to create, and `create` is refused for a file
 * that exists. Re-resolving turns that into the `add` it should have been.
 *
 * The mechanism is `../resolving.ts`'s, which is where the whole argument for
 * it lives — including why the retry compares the OP and why it fires once. All
 * this supplies is the two things that differ here: the reading is the outline
 * PATHS (what the inbox convention is read off, and the only shape a face with
 * no store can get) and the run is a surface call that names no writer, because
 * the face this dispatches at already decided one.
 *
 * IT USED TO ASK FOR THE LISTING and drop everything but the file names, which
 * is the whole corpus materialised per capture — and the retry above means
 * twice. `ops.paths` is the same question without the records
 * (`perf-capture-paths`); the listing is still what `list_outlines` answers,
 * counts and all.
 */
const planned = (
  tool: Extract<Tool, { readonly kind: "plan" }>,
  door: Door,
  args: unknown,
  login: string | null,
): Effect.Effect<Applied, OpFailure> =>
  Effect.map(
    resolvedWrite(
      Effect.map(door.paths, (listed): Planning => ({
        paths: listed.paths,
        login,
        // Read PER CALL, so a process left running overnight still dates a
        // capture today — `asking`'s rule for `date:yesterday`, kept here.
        now: () => stampOf(new Date()),
      })),
      (at) => tool.plan(at, args as never),
      door.run,
      true,
    ),
    (written) => written.done,
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
