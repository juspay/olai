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
import { STAMP, steady } from "@olai/ops/testlib"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { bind, gitWiring } from "../runtime.ts"
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
      commits: "off",
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

    const wired = yield* bind({
      store,
      chat: null,
      git: gitWiring(ops, "mcp", yield* SubscriptionRef.make(0)),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    yield* serveFace({
      bound: wired.bound,
      tools: bespokeFrom(TOOLS, ops, "mcp"),
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
      "add_mirror",
      "add_node",
      "archive_node",
      "commit",
      "create_outline",
      "list_outlines",
      "move_node",
      "read_node",
      "read_subtree",
      "remove_mirror",
      "search_nodes",
      "set_after",
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
 * A read that is not DESCRIBED is a read nothing will make.
 *
 * The 2026-08-11 review's must-fix, and it is a contract rather than a comment:
 * placements are kept out of search and out of every child list on purpose, so
 * `read_node` is the ONLY way to reach one — and an agent chooses a tool by its
 * description, never by this repository's source. `mirrors` retires an entry
 * from the finished item's side, `placed` reads the list from the list's side,
 * and `after` is what a dependency is removed by. The data was already answered
 * when this test was written; what was missing was anybody being told.
 */
test("the read tools teach the fields the mirror and edge ops depend on", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const said = (name: string) =>
      tools.find((tool) => tool.name === name)?.description ?? ""

    for (const field of ["`mirrors`", "`placed`", "`after`", "`remove_mirror`"]) {
      expect(said("read_node")).toContain(field)
    }
    expect(said("search_nodes")).toContain("`after`")
    // …and the subtree read says where to go instead, since it walks none.
    expect(said("read_subtree")).toContain("`placed`")
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

/**
 * The batch capture, through the wire it exists for.
 *
 * One call, a tree three levels deep, and the answer names every node it made —
 * which is what lets the next call reach one of them without a search for an id
 * nobody chose.
 */
test("one add_node lands a whole subtree, and says what it made", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read, set }) => {
    const answer = await call(client, "add_node", {
      parent: "kitchen",
      title: "the pantry",
      children: [
        { title: "shelves", children: [{ title: "measure", mark: "todo" }] },
        { title: "paint", desc: "the same white", mark: "done" },
      ],
    })

    expect(answer.isError).toBe(false)
    expect(answer.structured).toMatchObject({
      did: "add_node",
      title: "the pantry",
      summary: "capture: the pantry (+3)",
    })
    const captured = answer.structured["captured"] as ReadonlyArray<
      { id: string; title: string }
    >
    expect(captured.map((node) => node.title)).toEqual([
      "the pantry",
      "shelves",
      "measure",
      "paint",
    ])

    const text = read("house.jsonl") ?? ""
    expect(text.split("\n").filter((line) => line !== "")).toHaveLength(8)
    expect(text).toContain(`"todo":true`)
    expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)

    // The tree is a tree: `measure` hangs off `shelves`, which hangs off the
    // node the call named.
    const nodes = new Map(
      (await set()).nodes.map((located) => [located.node.id, located.node]),
    )
    const [pantry, shelves, measure] = captured
    expect(nodes.get(shelves?.id ?? "")).toMatchObject({ parent: pantry?.id })
    expect(nodes.get(measure?.id ?? "")).toMatchObject({ parent: shelves?.id })
  })
})

/**
 * What an agent is SHOWN of that, and the reason the nesting is unrolled rather
 * than recursive.
 *
 * Effect compiles a recursive schema to a `$ref` into a `$defs` pool, and the
 * adapter inlines every local ref and strips the pool — because `$ref` is
 * rejected across the host matrix it is byte-compatible with. A ref it cannot
 * inline finitely survives as a pointer into a pool that is no longer there, so
 * a recursive `children` would advertise a DANGLING reference and take the
 * whole tool down with it. Unrolled, the schema is a finite object, and this is
 * the fence that says so.
 */
test("both capture tools advertise children as a finite nested schema, no $ref", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    const nested = (schema: unknown): Record<string, unknown> | undefined =>
      ((schema as { properties?: Record<string, { items?: unknown }> })
        ?.properties?.["children"]?.items) as Record<string, unknown> | undefined

    /** The `children` chain of one capture root, level by level. Both tools take
     *  the same root, so both are walked the same way — a seed that nested less
     *  deeply than a capture would be a reason to make a second call. */
    const walk = (root: unknown): void => {
      // Three levels of `children`, each a real object schema an agent can fill
      // in, and the fields of a child are the fields of the node itself.
      let at = root
      for (let level = 0; level < 3; level++) {
        at = nested(at)
        expect(Object.keys((at as { properties: object })?.properties ?? {}).sort())
          .toEqual(["children", "date", "desc", "id", "mark", "title"])
      }
      // The floor: the field is still there — an Effect struct drops a key it
      // does not declare, and a capture that lost its deepest level quietly
      // would be worse than one that is refused — but it offers no shape to fill
      // in, and its description says a fourth level is a second call.
      const floor = (at as { properties: Record<string, Record<string, unknown>> })
        .properties["children"] as Record<string, unknown>
      expect(floor["type"]).toBe("array")
      expect(floor["items"]).toBeUndefined()
      expect(String(floor["description"])).toContain("second `add_node`")
    }

    const add = tools.find((tool) => tool.name === "add_node")
    expect(JSON.stringify(add?.inputSchema)).not.toContain("$ref")
    walk(add?.inputSchema)

    // The seed of a brand-new outline is the same capture, unrolled the same
    // way. Effect inlines it a second time rather than sharing a `$defs` entry
    // — which is the cost of the pool being stripped, and is measured in the
    // PR rather than hidden here.
    const create = tools.find((tool) => tool.name === "create_outline")
    expect(JSON.stringify(create?.inputSchema)).not.toContain("$ref")
    walk(
      (create?.inputSchema as { properties: Record<string, unknown> })
        .properties["seed"],
    )
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

// ── mirrors and edges, through the wire ────────────────────────────────

/** Two files, because that is what a mirror is for: `parent` cannot cross an
 *  outline, so a node appearing in a second file at all is a placement. */
const LEDGER = [
  `{"id":"now","ord":"a0","title":"Now"}`,
  "",
].join("\n")

/**
 * The whole ledger gesture, end to end and in one test, because it is one
 * gesture: an item becomes live, so it is PLACED on the Now list; it finishes,
 * so the placement is RETIRED. Neither step touches the item.
 *
 * This is the loop the roadmap item was filed for — `add_node` mints only
 * regular nodes, so keeping Now up to date meant hand-editing the file, which is
 * exactly the practice the 2026-08-11 RCA condemns.
 */
test("a mirror is placed, found from the node, and retired — the node untouched", async () => {
  await withTools(
    { "house.jsonl": HOUSE, "now.jsonl": LEDGER },
    async ({ client, read }) => {
      const placed = await call(client, "add_mirror", {
        target: "order",
        parent: "now",
        id: "now-order",
      })
      expect(placed.isError).toBe(false)
      expect(placed.structured).toMatchObject({
        did: "add_mirror",
        // The placement's id is what the answer names — it is what retires it —
        // and the title is the node's, which is what a person reads.
        id: "now-order",
        title: "order the cabinets",
        file: "now.jsonl",
        summary: "mirror: order the cabinets",
      })
      // Four fields, and no title, mark or note anywhere on the line.
      expect(read("now.jsonl")).toContain(
        `{"id":"now-order","parent":"now","ord":"a0","mirror":"order"}`,
      )
      // The node it shows is not rewritten at all.
      expect(read("house.jsonl")).toBe(HOUSE)

      // …and it is FINDABLE, which is what makes retiring it possible in a
      // session that did not place it: mirrors are left out of search and out of
      // every child list, so the node is where you ask.
      const node = (await call(client, "read_node", { id: "order" })).structured
      expect(node["mirrors"]).toEqual([
        { id: "now-order", file: "now.jsonl", line: 2, parent: "now" },
      ])

      const retired = await call(client, "remove_mirror", { id: "now-order" })
      expect(retired.isError).toBe(false)
      expect(retired.structured).toMatchObject({
        did: "remove_mirror",
        summary: "unmirror: order the cabinets",
      })
      expect(read("now.jsonl")).toBe(LEDGER)
      expect(read("house.jsonl")).toBe(HOUSE)
      // Nothing shows it any more, and the field goes rather than emptying.
      expect((await call(client, "read_node", { id: "order" })).structured)
        .not.toHaveProperty("mirrors")
    },
  )
})

/**
 * The list read from the LIST's side — "what is on Now?".
 *
 * The other half of the ledger gesture, and the one an orchestrator opening a
 * fresh session starts from: it has not placed anything yet, so it cannot ask
 * an item where it is placed. It asks the list what is on it, and each row
 * carries both the id that retires the entry and the node it stands for.
 */
test("read_node answers what a curated list holds, with what each entry shows", async () => {
  await withTools(
    { "house.jsonl": HOUSE, "now.jsonl": LEDGER },
    async ({ client }) => {
      await call(client, "add_mirror", { target: "order", parent: "now", id: "now-order" })
      await call(client, "add_mirror", { target: "install", parent: "now", id: "now-install" })

      const now = (await call(client, "read_node", { id: "now" })).structured
      expect(now["children"]).toEqual([])
      expect(now["placed"]).toEqual([
        {
          id: "now-order",
          file: "now.jsonl",
          line: 2,
          parent: "now",
          shows: {
            id: "order",
            title: "order the cabinets",
            file: "house.jsonl",
            line: 3,
            path: ["Kitchen remodel"],
          },
        },
        {
          id: "now-install",
          file: "now.jsonl",
          line: 3,
          parent: "now",
          shows: {
            id: "install",
            title: "install them",
            file: "house.jsonl",
            line: 4,
            status: "doing",
            path: ["Kitchen remodel"],
          },
        },
      ])
    },
  )
})

test("remove_mirror on a node refuses, and says what does put a node away", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "remove_mirror", { id: "order" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("usage")
    expect(String(answer.structured["reason"])).toContain("archive_node")
    expect(refusals).toEqual(["unmirror: UsageFailure"])
    expect(read("house.jsonl")).toBe(HOUSE)
  })
})

/** The other half of ledger-complete: a dependency, written from the node that
 *  waits, read back off the node, and refused when it would close a loop. */
test("set_after writes a dependency, and a loop is refused naming it", async () => {
  await withTools({ "house.jsonl": HOUSE }, async ({ client, read }) => {
    const wired = await call(client, "set_after", { id: "install", add: ["order"] })
    expect(wired.isError).toBe(false)
    expect(wired.structured).toMatchObject({ summary: "after: install them" })
    expect(read("house.jsonl")).toContain(`"after":["order"]`)

    // Read back off the node, so the next call can remove one by id.
    expect((await call(client, "read_node", { id: "install" })).structured)
      .toMatchObject({ after: ["order"] })

    const loop = await call(client, "set_after", { id: "order", add: ["install"] })
    expect(loop.isError).toBe(true)
    expect(loop.structured["kind"]).toBe("usage")
    expect(String(loop.structured["reason"])).toContain("`order` → `install` → `order`")
  })
})
