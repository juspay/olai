/**
 * The tool surface, through a real MCP client.
 *
 * These moved here from `@olai/ops`' `ops.test.ts` when the projection did, and
 * they got stronger on the way. They used to call a dispatch function directly,
 * which proved what olai's own code decided and nothing about what an agent
 * receives. Now every one of them goes through the SDK's `Client`, the adapter's
 * schema bridge and its result framing — so the thing under test is the thing an
 * agent actually talks to.
 *
 * What is asserted here is the CONTRACT, and three parts of it are load-bearing
 * enough to have their own tests:
 *
 *   - the tool list is closed, and what is missing from it is the design — no
 *     file read, no file write, no shell, no grep;
 *   - the field a tool's NAME already decides never reaches the agent;
 *   - a refusal is an ANSWER: `isError`, with the structured detail beside the
 *     prose, so "which node?" is data rather than a sentence to parse.
 *
 * The third is the one this whole migration waited on (juspay/kolu#2155) and it
 * is the reason `structuredContent` is asserted rather than the text: the BDD
 * harnesses in `packages/tests` read every tool answer that way too, and this is
 * the unit-level fence under them.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { type OutlineError, type OutlineSet } from "@olai/format"
import { codec, make as makeOps, TOOLS } from "@olai/ops"
import { GIT_OFF } from "@olai/surface"
import { STAMP, steady } from "@olai/ops/testlib"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { bind } from "../runtime.ts"
import { serveFace } from "./face.ts"
import { bespokeFrom } from "./tools.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","doing":"2026-08-02"}`,
  "",
].join("\n")

interface Fixture {
  readonly client: Client
  readonly read: (file: string) => string | null
  readonly set: () => Promise<OutlineSet>
  /** Every write the ops layer refused, as `<op>: <tag>`. Collected at the OPS
   *  seam, so it records a refusal whichever caller asked for the write — which
   *  is what proves the observer still fires now that the caller changed. */
  readonly refusals: ReadonlyArray<string>
}

/** The whole face over a fresh directory: store, ops, surface, tools, and an
 *  MCP client on the other end of a linked transport pair. */
const withTools = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Promise<A>,
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-tools-")))
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }

  return Effect.gen(function*() {
    const store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>> = yield* Store.make({
      root,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const refusals: Array<string> = []
    const ops = makeOps({
      store,
      root,
      commit: false,
      // The ops layer's own fixture context — deterministic ids and one fixed
      // instant — rather than a second spelling of it up here, which is a
      // fixture free to drift from the assertions that package is written
      // against.
      context: steady(),
      onRefusal: (request, failure) =>
        Effect.sync(() => {
          refusals.push(`${request.op}: ${failure._tag}`)
        }),
    })

    const wired = yield* bind({ store, chat: null, git: GIT_OFF })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    yield* serveFace({
      bound: wired.bound,
      tools: bespokeFrom(TOOLS, ops),
      transport: serverSide,
    })

    const client = new Client({ name: "tools.test", version: "0" })
    yield* Effect.promise(() => client.connect(clientSide))
    yield* Effect.addFinalizer(() => Effect.promise(() => client.close()))
    yield* Effect.addFinalizer(() => runtime.stopped)

    return yield* Effect.promise(() =>
      use({
        client,
        refusals,
        read: (file) => {
          const at = path.join(root, file)
          return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
        },
        set: () =>
          Effect.runPromise(
            Effect.map(SubscriptionRef.get(store.snapshot), (snapshot) => {
              if (snapshot === null) throw new Error("the fixture directory never loaded")
              return snapshot.value
            }),
          ),
      })
    )
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

interface Answer {
  readonly structured: Record<string, unknown>
  readonly isError: boolean
}

/** Call a tool and read BOTH halves of what came back. `structuredContent` is
 *  what every assertion below reads, and it is always present now — on the
 *  refusal arm as much as the success one. */
const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Answer> => {
  const result = await client.callTool({ name, arguments: args }) as {
    structuredContent?: Record<string, unknown>
    isError?: boolean
  }
  return {
    structured: result.structuredContent ?? {},
    isError: result.isError === true,
  }
}

// ── what the agent is offered ──────────────────────────────────────────

test("the tool list is reads and writes, and no file access at all", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    // The whole surface, spelled out — because what is NOT here is the design:
    // no file read, no file write, no shell, no grep.
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "add_node",
      "archive_node",
      "create_outline",
      "list_outlines",
      "move_node",
      "read_node",
      "read_subtree",
      "search_nodes",
      "set_date",
      "set_desc",
      "set_doing",
      "set_done",
      "set_see",
      "set_title",
      "set_todo",
    ])

    // The discriminator the tool NAME already decides is not a field the agent
    // has to fill in. Subtracted from the SCHEMA now rather than from the
    // compiled JSON Schema, so what is advertised and what is decoded against
    // are one object.
    const done = tools.find((tool) => tool.name === "set_done")
    expect(Object.keys(done?.inputSchema.properties ?? {}).sort()).toEqual(["id", "undo"])
    expect(JSON.stringify(done?.inputSchema)).not.toContain(`"op"`)

    // A tool that takes NOTHING advertises the empty object, and this is a
    // fence rather than a formality. Effect compiles `Schema.Struct({})` to
    // `anyOf: [object, array]`, which the adapter reads as a non-object input
    // and advertises wrapped under a `value` property — after which every call
    // is refused with "Expected object | array". `list_outlines` is the first
    // call an agent makes, so that bug is the whole capture flow.
    const list = tools.find((tool) => tool.name === "list_outlines")
    expect(list?.inputSchema).toMatchObject({ type: "object", properties: {} })
    expect(JSON.stringify(list?.inputSchema)).not.toContain(`"value"`)
  })
})

test("each tool carries its title and its description", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const search = tools.find((tool) => tool.name === "search_nodes")
    // MCP's two metadata fields do two jobs: the description is written for the
    // model choosing the tool, the title for the human reading a host's list.
    // Both come off the ops table, which is the single place a tool is
    // described — `title` survived migration because kolu#2155 added the field.
    expect(search?.title).toBe("Search nodes")
    expect(search?.description).toContain("Find nodes by title")
  })
})

/**
 * BOTH hints, on both kinds — and `destructiveHint` is the one that matters
 * here, because it CHANGED.
 *
 * The hand-rolled `describe()` emitted `destructiveHint: false` for every tool,
 * read or write. The adapter derives both hints from one `mutates` flag, so a
 * write is now advertised destructive and that is no longer separately
 * expressible. It is arguably the honest answer — `set_title` replacing a title
 * is not an additive update — but it is a wire change hosts key off: a host that
 * groups tools, or asks before running a destructive one, will treat every olai
 * write differently than it did.
 *
 * So it is pinned. Someone "simplifying" this back to a blanket `false` fails
 * here rather than shipping a quieter confirmation prompt nobody asked for.
 */
test("both annotation hints are pinned, for a read and for a write", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const of = (name: string) => tools.find((tool) => tool.name === name)?.annotations

    // `readOnlyHint` can let a host run a call without asking, so it is a
    // conscious opt-in and only the query tools get it.
    expect(of("search_nodes")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("read_subtree")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("set_done")).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    expect(of("archive_node")).toMatchObject({ readOnlyHint: false, destructiveHint: true })
  })
})

test("initialize tells a host what olai is", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    // Reachable only because the adapter passes it to the SDK, which serves
    // `initialize` inside its own protocol layer. The prose is load-bearing: an
    // agent arrives assuming files, and this is where it is told there are none.
    expect(client.getInstructions()).toContain("about NODES, not files")
    expect(client.getServerVersion()).toMatchObject({ name: "olai" })
  })
})

// ── reading ────────────────────────────────────────────────────────────

test("a read answers over parsed nodes, with file:line and the marks", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    const hits = (await call(client, "search_nodes", { text: "cabinets" })).structured
    expect(hits["total"]).toBe(1)
    const hit = (hits["hits"] as ReadonlyArray<Record<string, unknown>>)[0]
    expect(hit).toMatchObject({
      id: "order",
      file: "house.jsonl",
      line: 3,
      path: ["Kitchen remodel"],
    })
    // `order` carries no mark, so it has no status — and the answer says that by
    // leaving the field out rather than by inventing a word for it. An agent
    // reading a corpus of notes gets nodes, not to-dos.
    expect(hit).not.toHaveProperty("status")

    // `kitchen` carries no mark either, so what an agent learns instead is the
    // ROLLUP: two of its children are tasks, one of them done. An annotation,
    // and the reason it is not a status is that nobody has called `kitchen` work.
    const kitchen = (await call(client, "read_node", { id: "kitchen" })).structured
    expect(kitchen).not.toHaveProperty("status")
    expect(kitchen["progress"]).toEqual({ done: 1, total: 2 })
  })
})

test("search and subtree carry a node's see so an agent can traverse", async () => {
  const SEEING = [
    `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","see":["install"]}`,
    `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
    "",
  ].join("\n")

  await withTools({ "house.jsonl": SEEING }, async ({ client }) => {
    const hits = (await call(client, "search_nodes", { text: "cabinets" })).structured
    expect((hits["hits"] as ReadonlyArray<unknown>)[0]).toMatchObject({
      id: "order",
      see: ["install"],
    })

    const tree = (await call(client, "read_subtree", { id: "kitchen", depth: 1 })).structured
    const children = tree["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children.find((child) => child["id"] === "order")).toMatchObject({
      see: ["install"],
    })
    // A node with no see does not pretend to have one.
    expect(children.find((child) => child["id"] === "install")).not.toHaveProperty("see")
  })
})

// ── writing ────────────────────────────────────────────────────────────

test("a write through a tool changes the directory", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read }) => {
    const answer = await call(client, "set_done", { id: "order" })
    expect(answer.isError).toBe(false)
    expect(answer.structured).toMatchObject({ did: "set_done", id: "order" })
    expect(read("house.jsonl")).toContain(`"done":${JSON.stringify(STAMP)}`)
  })
})

test("create_outline mints a file through the same tool surface as every other write", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read, set }) => {
    const answer = await call(client, "create_outline", {
      file: "inbox.jsonl",
      seed: { title: "something to capture" },
    })
    expect(answer.structured).toMatchObject({
      did: "create_outline",
      file: "inbox.jsonl",
      title: "something to capture",
      summary: "capture: something to capture",
    })
    expect(read("inbox.jsonl")).toContain("something to capture")
    expect((await set()).files).toContain("inbox.jsonl")
  })
})

/**
 * Marking a parent, all the way through. It used to be the refusal this whole
 * error taxonomy was built around; it is now an ordinary write, and what the
 * agent gets back instead is the NUDGE — the one task still open under the
 * branch it just ticked, as part of the answer rather than as a reason nothing
 * happened.
 */
test("marking a parent lands, and the answer carries what the rollup noticed", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "set_done", { id: "kitchen" })
    expect(answer.isError).toBe(false)
    // Only `install` is unfinished: `demo` is done, and `order` carries no mark
    // at all, so it is a bullet rather than an unstarted task.
    expect(answer.structured["nudge"]).toContain("`install them`")
    expect(answer.structured["nudge"]).not.toContain("order the cabinets")
    expect(refusals).toEqual([])
    expect(read("house.jsonl")).toContain(`"id":"kitchen"`)
    expect(read("house.jsonl")).toContain(`"done":${JSON.stringify(STAMP)}`)
  })
})

// ── refusing ───────────────────────────────────────────────────────────

/**
 * The contract this migration waited on.
 *
 * A refusal is an ANSWER, not a protocol fault, so it comes back as a successful
 * call carrying `isError` — and its detail arrives as DATA. Before kolu#2155 the
 * adapter could only carry the sentence, which is why this could not move.
 */
test("a refused write is an isError result carrying its kind", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "set_done", { id: "nowhere" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("not-found")
    expect(answer.structured["named"]).toBe("nowhere")
    // The observer still fires, and it hangs off OPS rather than off whatever is
    // calling — which is the property that survived the caller being replaced.
    expect(refusals).toEqual(["done: NotFoundFailure"])
    expect(read("house.jsonl")).toBe(HOUSE)
  })
})

test("arguments that do not fit the tool are refused before any planning", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "set_done", { nope: 1 })
    expect(answer.isError).toBe(true)
    // Refused at the SCHEMA, so the ops layer was never asked and has nothing to
    // report: a malformed call is not a refused write.
    expect(refusals).toEqual([])
    expect(read("house.jsonl")).toBe(HOUSE)
  })
})

test("a tool that does not exist is an error result, not a protocol error", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    // A CHANGE from the hand-rolled dispatch, which answered JSON-RPC -32602.
    // The SDK's convention is that an unknown tool is a tool-level error, and it
    // is the better one: a model that asked for a tool it does not have can read
    // the answer and pick another, where a protocol error throws inside its
    // client.
    const answer = await call(client, "read_file", {})
    expect(answer.isError).toBe(true)
  })
})

test("list_outlines then add_node — the capture sequence an agent actually runs", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read }) => {
    const listed = (await call(client, "list_outlines", {})).structured

    const outlines = listed["outlines"] as ReadonlyArray<{ file: string }>
    expect(outlines[0]?.file).toBe("house.jsonl")

    const added = await call(client, "add_node", {
      file: outlines[0]?.file,
      title: "water the plants",
    })
    expect(added.isError).toBe(false)
    expect(read("house.jsonl")).toContain("water the plants")
  })
})
