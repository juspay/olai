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
 *     shell, no grep, no directory walk, and no read or write that names a
 *     byte. It is NOT "no file access": the document verbs name files, which
 *     is why the charter test below pins that retired sentence against the
 *     list rather than for it;
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
import { type FailureKind, type OutlineSet, outlinePaths, verdictOf } from "@olai/format"
import { recordsOf } from "@olai/format/testlib"
import {
  codec,
  fixedPolicy,
  make as makeOps,
  type Store as OutlineStore,
  TOOLS,
} from "@olai/ops"
import { STAMP, steady } from "@olai/ops/testlib"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, Result, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { bind, gitWiring, writerAt } from "../runtime.ts"
import { frozenPolicy } from "../serve.testlib.ts"
import { clientOver, serveFace } from "./face.ts"
import { bespokeFrom } from "./tools.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","doing":"2026-08-02"}`,
  "",
].join("\n")

/** A dated chore, for the recurrence tests below: one node, so what the file
 *  holds after a completion is exactly what the completion did. */
const CHORES = [
  `{"id":"bins","ord":"a0","title":"put the bins out","todo":true,"date":"2026-08-17"}`,
  "",
].join("\n")

/** A SET-WIDE break, and it has to be one: a lone unparseable file is absorbed
 *  — the survivors are clean, so it rides as `OutlineSet.broken` and the rest
 *  stays live (format's error scope). What REJECTS a set is a rule that needs to
 *  know what else exists, and a `parent` nothing declares is the plainest. */
const ORPHAN = `{"id":"stray","parent":"kitchn","ord":"a0","title":"a lost row"}\n`

interface Fixture {
  readonly client: Client
  /** The directory this face is serving. Every answer names it now, so a case
   *  asserting a whole answer has to be able to name it too. */
  readonly root: string
  readonly read: (file: string) => string | null
  readonly set: () => Promise<OutlineSet>
  /** Every write the ops layer refused, as `<op>: <tag>`. Collected at the OPS
   *  seam, so it records a refusal whichever caller asked for the write — which
   *  is what proves the observer still fires now that the caller changed. */
  readonly refusals: ReadonlyArray<string>
}

/**
 * The whole face over a fresh directory: store, ops, surface, tools, and an
 * MCP client on the other end of a linked transport pair.
 *
 * `unreadable` is the one seam a caller may replace, and it is here because
 * one arm of the contract cannot be reached any other way. A bodied file's
 * `decode` CANNOT fail in production — `@olai/ops`' codec answers
 * `Result.succeed({ file, text })` for every `.md` — so a document lands in
 * `set.broken` only when the store hands over a failed read, which on the disk
 * store fails the whole probe rather than one file. The refusal that arm
 * produces is still real, still reachable through a socket, and still what
 * `write_document`'s own `writable` gate has always done; naming these paths
 * fails their decode and leaves EVERYTHING above the codec — store, set,
 * surface, adapter, client — exactly as it is. What is injected is one
 * `Result`, at the one place production would have injected it.
 */
const withTools = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Promise<A>,
  unreadable: ReadonlySet<string> = new Set(),
  /** Who this face knows — `null` (the default) being the honest answer for
   *  `/mcp` and for an in-process panel, both of which have no identity at all. */
  login: string | null = null,
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-tools-")))
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }

  return Effect.gen(function*() {
    const store: OutlineStore = yield* Store.make({
      root,
      codec: unreadable.size === 0 ? codec : {
        ...codec,
        decode: (file: string, contents: string) =>
          unreadable.has(file)
            // `unreadable-directory` with a `line` of 0 is what the store's own
            // `codec.unreadable` raises for a path it could not read — the
            // closest legal code, rather than one invented for a test.
            ? Result.fail(verdictOf([{
              file,
              line: 0,
              code: "unreadable-directory" as const,
              message: `${file} could not be read`,
            }]))
            : codec.decode(file, contents),
      },
      watch: false,
      settle: "10 millis",
    })
    const refusals: Array<string> = []
    const ops = makeOps({
      store,
      root,
      policy: fixedPolicy({ commit: "off", push: null }),
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
      ops,
      writer: "mcp",
      git: gitWiring(
        ops,
        frozenPolicy({ commit: "off", push: null }),
        yield* SubscriptionRef.make(0),
      ),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    yield* serveFace({
      client: () => clientOver(writerAt(wired.bound, ops, "mcp")),
      tools: bespokeFrom(TOOLS, { login: () => login, root }),
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
        // The directory this face is serving — handed to a case because every
        // answer now carries it, so a case that asserts a whole answer has to be
        // able to name it.
        root,
        read: (file) => {
          const at = path.join(root, file)
          return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
        },
        set: () =>
          Effect.runPromise(
            Effect.map(SubscriptionRef.get(store.snapshot), (snapshot) => {
              if (snapshot === null) throw new Error("the fixture directory never loaded")
              return snapshot.value.set
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

/** The rows out of a refusal's detail — one spelling, because the detail is a
 *  VERDICT now (`@olai/format`'s `verdict.ts`) and eight assertions reaching
 *  through it by hand is eight places to update the day it grows a member. */
const findingsOf = (
  structured: Record<string, unknown>,
): ReadonlyArray<Record<string, unknown>> =>
  (structured["verdict"] as { readonly findings?: ReadonlyArray<Record<string, unknown>> })
    ?.findings as ReadonlyArray<Record<string, unknown>>

// ── what the agent is offered ──────────────────────────────────────────

test("the tool list is reads and writes, and nothing that names a byte", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    // The whole surface, spelled out — because what is NOT here is the design:
    // no shell, no grep, no directory walk, no read or write that names a
    // byte. The four document tools are the closest thing to file access the
    // surface has, and they are still the ops layer's: a whole `.md` at both
    // ends — out of the served snapshot, and back through the same validate →
    // stage → rename → commit gate — never a byte range, never a path the set
    // does not already hold.
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "add_mirror",
      "add_node",
      "apply",
      "capture",
      "commit",
      "create_document",
      "create_outline",
      "duplicate_node",
      "empty_trash",
      "list_documents",
      "list_outlines",
      "merge_node",
      "move_node",
      "push",
      "read_document",
      "read_node",
      "read_subtree",
      "remove_mirror",
      "search_nodes",
      "set_after",
      "set_cancelled",
      "set_date",
      "set_desc",
      "set_doing",
      "set_done",
      "set_prop",
      "set_repeat",
      "set_see",
      "set_title",
      "set_todo",
      "split_node",
      "trash_node",
      "untrash_node",
      "update",
      "write_document",
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

/**
 * The two git verbs, as an agent is offered them — HACKING.md's consistency
 * rule at the seam where it is easiest to break: the panel grew checkboxes, so
 * the tool grew `paths`, and a face that had one without the other would be two
 * different products.
 */
test("the git verbs offer an agent what the panel offers a person", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    const commit = tools.find((tool) => tool.name === "commit")
    expect(Object.keys(commit?.inputSchema.properties ?? {}).sort())
      .toEqual(["message", "paths"])
    // Both halves of the selection story reach the model, because a tool it has
    // to guess at is a tool it uses wrongly: the paths are the ones `pending`
    // publishes, and it sweeps everything when they are omitted.
    expect(commit?.description).toContain("pending")
    expect(commit?.description).toContain("index")

    // Push takes NOTHING, and that is the design rather than an omission.
    const push = tools.find((tool) => tool.name === "push")
    expect(push?.inputSchema).toMatchObject({ type: "object", properties: {} })
    expect(push?.description).toContain("upstream")
  })
})

/** And it is reachable: under `--commit=off` the answer is `Blocked`, which is
 *  an ANSWER — `isError` is for a refused write, and every way pushing can go
 *  wrong is something a caller is entitled to read. */
test("push answers rather than failing when there is nothing to push to", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const answered = await call(client, "push", {})
    expect(answered.isError).toBe(false)
    expect(answered.structured).toMatchObject({ _tag: "Blocked", did: "push" })
  })
})

test("each tool carries its title and its description", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const search = tools.find((tool) => tool.name === "search_nodes")
    // MCP's two metadata fields do two jobs: the description is written for the
    // model choosing the tool, the title for the human reading a host's list.
    // Both come off the ops table, which is the single place a tool is
    // described — `title` survived migration because kolu#2155 added the field.
    expect(search?.title).toBe("Search the directory")
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
 *
 * `referencedBy` joined the list for exactly that reason and not by analogy: a
 * reference points one way on disk, so what TALKS ABOUT a node is unreachable
 * without it — and the browser draws that list under every zoomed node, which
 * would make it a fact a person can see and an agent cannot.
 */
test("the read tools teach the fields the mirror and edge ops depend on", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const said = (name: string) =>
      tools.find((tool) => tool.name === name)?.description ?? ""

    for (
      const field of [
        "`mirrors`",
        "`placed`",
        "`after`",
        "`remove_mirror`",
        "`referencedBy`",
        // …and blockedness, which joined for the same reason `referencedBy`
        // did: the app dims a row with it and names what a page is waiting on,
        // so a description that did not mention it would leave an agent
        // rebuilding the answer out of `after` — and getting it wrong, since a
        // `done` target and a bullet are in nobody's way.
        "`blockedBy`",
      ]
    ) {
      expect(said("read_node")).toContain(field)
    }
    expect(said("search_nodes")).toContain("`after`")
    // …and that a hit answers the properties too, which is the whole reason to
    // reach for one query instead of a query and a read per row — plus the
    // other half of "why is this here", which is on the schema as a bare
    // `string[]` and is taught nowhere else.
    expect(said("search_nodes")).toContain("`custom`")
    expect(said("search_nodes")).toContain("`matchedProps`")
    // …and the subtree read says where to go instead, since it walks none.
    expect(said("read_subtree")).toContain("`placed`")
    // …and that it reads a whole OUTLINE, which is the only way an agent finds
    // out: `list_outlines` names the roots of a file and this is what descends
    // into all of them at once. A tool nobody is told about is a tool nobody
    // calls, and the fallback — one call per root — looks like it works.
    expect(said("read_subtree")).toContain("`file`")
    // …and that a selection can arrive WITH its notes, for the same reason: it
    // is off by default, so an agent that is not told will read a node per hit.
    expect(said("search_nodes")).toContain("`withDesc: true`")
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
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const of = (name: string) => tools.find((tool) => tool.name === name)?.annotations

    // `readOnlyHint` can let a host run a call without asking, so it is a
    // conscious opt-in and only the query tools get it.
    expect(of("search_nodes")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("read_subtree")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    // The two document reads are reads on the same terms — neither touches
    // the disk, both answer out of the served snapshot.
    expect(of("list_documents")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("read_document")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("set_done")).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    expect(of("trash_node")).toMatchObject({ readOnlyHint: false, destructiveHint: true })
  })
})

test("initialize tells a host what olai is, and nothing the tools disprove", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    // Reachable only because the adapter passes it to the SDK, which serves
    // `initialize` inside its own protocol layer. The prose is load-bearing: an
    // agent arrives assuming a filesystem, and this is where it is told what the
    // units are instead.
    const said = client.getInstructions() ?? ""
    expect(said).toContain("NODES and whole FILES")
    expect(client.getServerVersion()).toMatchObject({ name: "olai" })

    // AND IT IS HELD TO THE TABLE. The charter said "there is no file access"
    // while `write_document` was already on the list, which is a claim an agent
    // disproves with its second call — after which the rest of the text is
    // decoration. So the one sentence that cannot come back is pinned against
    // the tools actually offered: documents are files, and four of these verbs
    // name one.
    expect(said).not.toContain("no file access")
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).filter((name) => name.includes("document")).sort())
      .toEqual(["create_document", "list_documents", "read_document", "write_document"])

    // THE SAME PIN, ONE UNIT ALONG. `empty_trash` empties `_olai/Trash.olai`, so an
    // enumeration that stopped at nodes and documents would be the same
    // disprovable sentence in a newer coat — and this one is worse to get
    // wrong, because the verb it leaves out is the only one that DELETES. The
    // charter names it and says so; a table that grows a second such verb, or
    // loses this one, fails here.
    expect(said).toContain("`empty_trash` empties `_olai/Trash.olai`")
    expect(said).toContain("the one tool here that deletes")
    expect(tools.map((tool) => tool.name).filter((name) => name.includes("empty")))
      .toEqual(["empty_trash"])

    // …and the claims that actually do the work still hold over the whole
    // table: no path outside the served directory, and nothing that can name
    // part of a file. Those are what make this a charter rather than a tour.
    expect(said).toContain("no path outside the served directory")
    expect(said).toContain("no way to name part of a file")
  })
})

// ── reading ────────────────────────────────────────────────────────────

test("a read answers over parsed nodes, with file:line and the marks", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const hits = (await call(client, "search_nodes", { text: "cabinets" })).structured
    expect(hits["total"]).toBe(1)
    const hit = (hits["hits"] as ReadonlyArray<Record<string, unknown>>)[0]
    expect(hit).toMatchObject({
      id: "order",
      file: "house.olai",
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

  await withTools({ "house.olai": SEEING }, async ({ client }) => {
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

/**
 * The same fence for `custom`, and it has to be HERE as well as in the ops
 * layer: this is the only test that goes through the encoder, which is where a
 * field produced by `foundOf` and unknown to the schema is silently DROPPED. It
 * happened once, to `matched` (`@olai/format`'s `searching.ts` header), and
 * `custom` is now on `Found` — one declaration both sides spread — so the drop
 * cannot recur. This is what makes that a checked fact rather than a claim.
 */
test("search and subtree carry a node's properties, so a board is one query", async () => {
  const PROPPED = [
    `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets",` +
    `"custom":{"pr":"https://github.com/juspay/olai/pull/179","agent":"claude-opus"}}`,
    `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
    "",
  ].join("\n")

  await withTools({ "house.olai": PROPPED }, async ({ client }) => {
    // Selected BY the property, and the answer already holds the other one —
    // the read-per-hit this field exists to remove.
    const hits = (await call(client, "search_nodes", { text: "prop:agent=claude-opus" }))
      .structured
    expect(hits["total"]).toBe(1)
    expect((hits["hits"] as ReadonlyArray<unknown>)[0]).toMatchObject({
      id: "order",
      custom: { pr: "https://github.com/juspay/olai/pull/179", agent: "claude-opus" },
      // …and WHICH property put it there, through the encoder — the seam that
      // once dropped `matched`, now carrying its sibling too.
      matchedProps: ["agent"],
    })

    // Both halves of "why is this here" on one hit, since both can be true:
    // the title carried the word, the map carried the key.
    const both = (await call(client, "search_nodes", { text: "cabinets prop:pr" })).structured
    expect((both["hits"] as ReadonlyArray<unknown>)[0]).toMatchObject({
      id: "order",
      matched: "title",
      matchedProps: ["pr"],
    })

    const tree = (await call(client, "read_subtree", { id: "kitchen", depth: 1 })).structured
    const children = tree["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children.find((child) => child["id"] === "order")).toMatchObject({
      custom: { agent: "claude-opus" },
    })
    // A node carrying no property does not answer an empty map.
    expect(children.find((child) => child["id"] === "install")).not.toHaveProperty("custom")
  })
})

// ── a whole outline, in one call ───────────────────────────────────────
//
// The read side catching up with the write side. `add_node` takes a nested
// capture and `apply` a run of verbs, so a subtree is one write — but an
// outline of N top-level roots had NO single-call read: `list_outlines` named
// the roots and `read_subtree` took an id, so reading a file whole was one call
// per root. These are that gap closed, through the client an agent uses.

/** An outline with SEVERAL roots — the shape the `file` arm exists for — and a
 *  placement at its top level, which is not one of them. */
const PLAN = [
  `{"id":"today","ord":"a0","title":"Today"}`,
  `{"id":"call","parent":"today","ord":"a0","title":"call the joiner","todo":true,` +
  `"desc":"about the hinges, and the delivery slot"}`,
  `{"id":"later","ord":"a1","title":"Later"}`,
  // A second placement of `call`, at the top level of the same file.
  `{"id":"echo","ord":"a2","mirror":"call"}`,
  "",
].join("\n")

test("read_subtree answers a whole outline — every root, one call", async () => {
  await withTools({ "plan.olai": PLAN, "house.olai": HOUSE }, async ({ client }) => {
    const answered = await call(client, "read_subtree", { file: "plan.olai" })
    expect(answered.isError).toBe(false)
    // The path rides back, so an agent holding several reads in flight knows
    // which file this one is about.
    expect(answered.structured["file"]).toBe("plan.olai")

    const roots = answered.structured["roots"] as ReadonlyArray<Record<string, unknown>>
    // BOTH roots — the whole claim, since these two used to be two calls — and
    // NOT the placement between them: a mirror is a second view of a node that
    // lives elsewhere, so elsewhere is where this read answers it.
    expect(roots.map((root) => root["id"])).toEqual(["today", "later"])
    // …and walked rather than merely named, which is what `list_outlines`
    // already does.
    const children = roots[0]?.["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children.map((child) => child["id"])).toEqual(["call"])
    expect(children[0]).toMatchObject({ status: "todo", path: ["Today"] })

    // And `depth` means the same thing on this arm, per ROOT: one bottoms out
    // where it was told to and says so, the other bottoms out at a leaf.
    const cut = (await call(client, "read_subtree", { file: "plan.olai", depth: 0 }))
      .structured["roots"] as ReadonlyArray<Record<string, unknown>>
    expect(cut[0]).toMatchObject({ id: "today", truncated: true })
    expect(cut[1]).not.toHaveProperty("truncated")
  })
})

/**
 * A PATH THAT IS NOT AN OUTLINE REFUSES IN `read_document`'s VOICE — the kind
 * as data, the near miss in the sentence. Refused, never answered empty: an
 * outline that "holds nothing" and an outline that is not there look identical
 * to a caller, and only one of them is worth acting on.
 */
test("read_subtree refuses a file that is not an outline, with the closest one", async () => {
  const files = {
    "plan.olai": PLAN,
    "house.olai": HOUSE,
    "finishes.md": "# Finishes\n",
  }
  await withTools(files, async ({ client }) => {
    const missed = await call(client, "read_subtree", { file: "plans.olai" })
    expect(missed.isError).toBe(true)
    expect(missed.structured).toMatchObject({ kind: "not-found", named: "plans.olai" })
    expect(missed.structured["reason"]).toContain("did you mean `plan.olai`")

    // The same typo at the WRITE verb that names an outline is told the same
    // thing, which is the property worth pinning: two tools, one sentence.
    const refusedWrite = await call(client, "add_node", {
      file: "plans.olai",
      title: "anything",
    })
    expect(refusedWrite.structured["reason"]).toContain("did you mean `plan.olai`")

    // Nothing close, and the answer is the outlines themselves — the right
    // answer for a directory of a handful of files, and deliberately not the
    // one an unknown NODE id gets, where the same list would be thousands long.
    const nowhere = await call(client, "read_subtree", { file: "nothing/like/this.olai" })
    expect(nowhere.structured["reason"]).toContain("plan.olai")
    expect(nowhere.structured["reason"]).toContain("house.olai")

    // A `.md` is not an outline either, and is refused by the same door rather
    // than walked as an empty one.
    const document = await call(client, "read_subtree", { file: "finishes.md" })
    expect(document.isError).toBe(true)
    expect(document.structured).toMatchObject({ kind: "not-found" })
  })
})

/**
 * AN OUTLINE THE SET COULD NOT LOAD refuses with the validator's rows — the
 * twin, over the other kind of file, of the document case further down.
 *
 * It is HERE and not only in `@olai/ops`' walk because that walk answers a
 * `Result` and the table test discharges it with an `orDie`: a refusal there is
 * a throw rather than an answer, so the arm an agent actually meets — `isError`
 * with the kind as data and the file's own rows beside it — is only assertable
 * through a client. It is also the one refusal on this read whose sentence is
 * chosen by the FILE rather than by the verb, which is the sort of thing an
 * encoder can drop without anything noticing.
 *
 * NOTHING IS INJECTED, unlike the document twin: an outline that does not parse
 * is a real state of a real directory. A lone one is absorbed — the survivors
 * are clean, so it rides as `OutlineSet.broken` and every other file stays live
 * — which is the format's error scope, and is exactly what makes "listed, and
 * refused" the honest pair of answers about it.
 */
test("read_subtree refuses an outline the set could not load", async () => {
  await withTools(
    { "plan.olai": PLAN, "torn.olai": "{ not a record" },
    async ({ client }) => {
      // It is LISTED — the directory serves it — carrying its own errors and
      // nothing else: a count and a root list are what a parse produces.
      const listed = (await call(client, "list_outlines", {})).structured["outlines"] as
        ReadonlyArray<Record<string, unknown>>
      expect(listed.find((one) => one["file"] === "torn.olai")).toEqual({
        file: "torn.olai",
        unreadable: [expect.any(String)],
      })

      // …and walking it refuses. Answering it as an outline holding nothing
      // would be indistinguishable, to a caller, from an outline somebody
      // emptied — and only one of those is worth acting on.
      const refused = await call(client, "read_subtree", { file: "torn.olai" })
      expect(refused.isError).toBe(true)
      expect(refused.structured).toMatchObject({ kind: "validation" })
      expect(findingsOf(refused.structured)).toBeArrayOfSize(1)

      // AND IT IS TOLD THE TRUTH ABOUT ITSELF, which is the half only this file
      // can check end to end: an outline is READ perfectly well and then has
      // lines the format cannot take, where a body is read or it is not. One
      // fact about the file (`notLoadedBecause`), and the file picks the clause
      // — so the `.md` twin below gets the other one.
      const reason = refused.structured["reason"] as string
      expect(reason).toContain("has lines that do not parse")
      expect(reason).not.toContain("could not be read")
      expect(reason).toContain("nothing to answer with")
    },
  )
})

test("read_subtree refuses a call naming both ways in, or neither", async () => {
  await withTools({ "plan.olai": PLAN }, async ({ client, root }) => {
    // Two questions in one call: the schema an MCP host reads is an object with
    // properties rather than an `anyOf` it may or may not honour, so "exactly
    // one" is the reader's to say — in words that name which is which.
    const both = await call(client, "read_subtree", { id: "today", file: "plan.olai" })
    expect(both.isError).toBe(true)
    expect(both.structured).toMatchObject({ kind: "usage" })
    expect(both.structured["reason"]).toContain("two different reads")

    const neither = await call(client, "read_subtree", {})
    expect(neither.isError).toBe(true)
    expect(neither.structured).toMatchObject({ kind: "usage" })
    expect(neither.structured["reason"]).toContain("whole outline")

    // …while an id the set does not hold is still an ANSWER. An id is minted
    // and carried around in prose; a path was listed or typed.
    const gone = await call(client, "read_subtree", { id: "nope" })
    expect(gone.isError).toBe(false)
    // `root` on every answer, this one included: which vault answered is a fact
    // about the ANSWER, not about the kind of answer, so an absence names its
    // vault exactly as a hit does.
    expect(gone.structured).toEqual({ missing: "nope", root })
  })
})

/**
 * A SELECTION WITH ITS NOTES — the other half of the same item, through the
 * encoder, which is where a field the schema has never heard of is silently
 * dropped (`matched`, once).
 */
test("search_nodes carries the notes when the query asks for them", async () => {
  await withTools({ "plan.olai": PLAN }, async ({ client }) => {
    const asked = (await call(client, "search_nodes", { text: "joiner", withDesc: true }))
      .structured["hits"] as ReadonlyArray<Record<string, unknown>>
    expect(asked[0]).toMatchObject({
      id: "call",
      desc: "about the hinges, and the delivery slot",
    })

    // …and not otherwise. A note is unbounded prose, so a query that will not
    // read one does not pay for twelve of them — which is the whole reason
    // this is the one record field a hit asks for.
    const plain = (await call(client, "search_nodes", { text: "joiner" }))
      .structured["hits"] as ReadonlyArray<Record<string, unknown>>
    expect(plain[0]).toMatchObject({ id: "call" })
    expect(plain[0]).not.toHaveProperty("desc")

    // A node with no note says nothing either way, on the format's own rule for
    // absence — so a caller reads `desc` the same way whether it asked or not.
    const bare = (await call(client, "search_nodes", { text: "Later", withDesc: true }))
      .structured["hits"] as ReadonlyArray<Record<string, unknown>>
    expect(bare[0]).toMatchObject({ id: "later" })
    expect(bare[0]).not.toHaveProperty("desc")
  })
})

// ── the documents, read back ───────────────────────────────────────────
//
// The half of the document story that did not exist until `md-second-class`:
// an agent could mint a `.md` and replace it whole, and had no tool that could
// tell it what was in one or which ones there were. Both reads answer out of
// the SAME served snapshot every other read here does, which is what makes a
// write's `was` a thing a caller can actually supply.

/** A vault with prose in it — a document at the root, one in a folder, an
 *  empty one, and a `.html` the app shows and the set keeps no body for. */
const VAULT = {
  "house.olai": HOUSE,
  "finishes.md": "# Finishes\n\nDoors: matte.\n",
  "notes/cabinets.md": "\n\n  Walnut, or birch.\n",
  "notes/plan.md":
    "---\nagent: claude-opus\nowners: [alice, bob]\n---\n# The plan\n",
  "empty.md": "",
  "saved/page.html": "<p>from the web</p>",
  // The other three kinds olai only SHOWS. They are members of the set — the
  // sidebar lists them, they have addresses and pages — and they are
  // deliberately not what these two verbs answer for, which is what the
  // listing below and the refusal further down hold.
  "data/sales.csv": "region,units\nnorth,12\n",
  "art/handle.png": "not really a picture\n",
  "reports/q3.pdf": "%PDF-1.4\n",
}

// A `.md` AND NOTHING ELSE, which is the sentence that did not change when the
// registry gained three kinds. What an agent is handed here is what it can
// WRITE BACK through `write_document` — a document's text, verbatim — so a
// picture in the answer would be a path the write verb refuses, and a `.csv`
// would be a body olai reads for a reader to LOOK at rather than one an edit is
// judged against. Both reads narrow through `markdownIn`/`markdownAt`
// (`@olai/format`'s set), which is one place rather than a filter per verb.
test("list_documents is the map of the other kind of file", async () => {
  await withTools(VAULT, async ({ client }) => {
    const answered = await call(client, "list_documents", {})
    expect(answered.isError).toBe(false)
    // Paths in the set's own order, each with the line it opens with and what
    // its text weighs. The heading marks are off the first — `# Finishes` is a
    // document called Finishes — and a document with nothing in it is named by
    // its FILE rather than by nothing: the title is the document's own face
    // now (`@olai/format`'s `Document`), and a face's title is total.
    expect(answered.structured["documents"]).toEqual([
      { file: "empty.md", title: "empty", bytes: 0 },
      { file: "finishes.md", title: "Finishes", bytes: 26 },
      { file: "notes/cabinets.md", title: "Walnut, or birch.", bytes: 22 },
      {
        file: "notes/plan.md",
        title: "The plan",
        bytes: 59,
        props: { agent: "claude-opus", owners: ["alice", "bob"] },
      },
    ])
  })
})

test("read_document answers the text a write would replace", async () => {
  await withTools(VAULT, async ({ client, root }) => {
    const answered = await call(client, "read_document", { file: "notes/cabinets.md" })
    expect(answered.isError).toBe(false)
    // Verbatim, blank lines and leading spaces included: what the listing
    // named is not what the read answers with, and an edit is derived from
    // this rather than from the title.
    expect(answered.structured).toEqual({
      file: "notes/cabinets.md",
      text: "\n\n  Walnut, or birch.\n",
      // Which vault this text came out of — on every answer, so a reader can
      // never be looking at the right document from the wrong directory.
      root,
    })
  })
})

/**
 * THE LOOP THE `was` GUARD WAS ALWAYS FOR, now closed at both ends.
 *
 * `write_document` refuses to land on text the caller never read, and until
 * this PR there was no tool that could hand an agent that text — so the guard
 * was either skipped or filled in from a resource a host may never have
 * surfaced. Read, edit, write back what you read: one snapshot, one gate.
 */
test("read then write is one loop: what was read is what the guard takes", async () => {
  await withTools(VAULT, async ({ client, read }) => {
    const was = (await call(client, "read_document", { file: "finishes.md" }))
      .structured["text"] as string
    const wrote = await call(client, "write_document", {
      file: "finishes.md",
      text: `${was}Handles: brass.\n`,
      was,
    })
    expect(wrote.isError).toBe(false)
    expect(read("finishes.md")).toBe("# Finishes\n\nDoors: matte.\nHandles: brass.\n")

    // And the read moved with the write — same snapshot, no second read path.
    expect((await call(client, "read_document", { file: "finishes.md" })).structured["text"])
      .toBe("# Finishes\n\nDoors: matte.\nHandles: brass.\n")
  })
})

/**
 * A MISSING PATH REFUSES IN THE VOICE EVERY OTHER TOOL REFUSES IN — the kind
 * as data, the near miss in the sentence, and the same near miss
 * `write_document` gives for the same typo. One path, one answer, whichever
 * verb it was typed at.
 */
test("read_document refuses a path the set does not hold, with the closest one", async () => {
  await withTools(VAULT, async ({ client }) => {
    const missed = await call(client, "read_document", { file: "finishs.md" })
    expect(missed.isError).toBe(true)
    expect(missed.structured).toMatchObject({ kind: "not-found", named: "finishs.md" })
    expect(missed.structured["reason"]).toContain("did you mean `finishes.md`")

    // The same typo at the write verb is told the same thing, which is the
    // property worth pinning: two tools, one sentence.
    const refusedWrite = await call(client, "write_document", {
      file: "finishs.md",
      text: "anything",
    })
    expect(refusedWrite.structured["reason"]).toContain("did you mean `finishes.md`")

    // The kinds the app SHOWS and keeps no body for are not documents either
    // read will answer — refused by name rather than handed back empty. One
    // answer for the four of them, because it is one narrowing and not a
    // filter per kind.
    for (const file of ["saved/page.html", "data/sales.csv", "art/handle.png", "reports/q3.pdf"]) {
      const shown = await call(client, "read_document", { file })
      expect({ file, isError: shown.isError }).toEqual({ file, isError: true })
      expect({ file, kind: shown.structured["kind"] }).toEqual({ file, kind: "not-found" })
    }

    // AND THE SHAPES A PATH ARGUMENT IS ATTACKED WITH. True by construction —
    // this read never opens a path: `markdownAt` asks the suffix and then
    // matches the set's own keys EXACTLY, so there is no join, no `realpath`
    // and no traversal to defeat. Pinned anyway, because "by construction" is
    // a property of the current construction: the day somebody resolves a path
    // here to be helpful, this is what says no.
    for (const file of ["../finishes.md", "/etc/passwd.md", "notes/../finishes.md", "./finishes.md"]) {
      const refused = await call(client, "read_document", { file })
      expect({ file, isError: refused.isError }).toEqual({ file, isError: true })
      expect({ file, kind: refused.structured["kind"] }).toEqual({ file, kind: "not-found" })
    }
  })
})

/**
 * A DOCUMENT THE SET COULD NOT READ refuses with the validator's rows — over
 * the wire, which is where the PR body claims it.
 *
 * The listing's half of this is pinned in `@olai/ops`' table walk (the torn
 * row is `{file, unreadable}` — the outline listing's twin). The READ's half
 * could only be asserted at the walk before now, because that walk answers a
 * `Result` and the table test discharges it with an `orDie` — a refusal there
 * is a throw, not an answer. This is the arm as an agent meets it: `isError`
 * with the kind as data and the file's own rows beside it, rather than the
 * empty text the set is carrying for that path.
 *
 * WHAT IS INJECTED and what is real: one `Result.fail` at the codec, because a
 * bodied file's decode cannot fail in production (see {@link withTools}).
 * Everything above it is the running system — the store assembles the set with
 * the file in `broken`, the ops layer refuses out of that set, and the answer
 * comes back through the adapter to a real `Client`.
 */
test("a document the set could not read is refused, not answered empty", async () => {
  await withTools(
    { ...VAULT, "torn.md": "whatever the bytes were" },
    async ({ client }) => {
      // It is LISTED — the directory serves it — carrying its errors and
      // nothing else: a title and a size are what a read produces.
      const listed = (await call(client, "list_documents", {})).structured["documents"] as
        ReadonlyArray<Record<string, unknown>>
      expect(listed.find((one) => one["file"] === "torn.md")).toEqual({
        file: "torn.md",
        unreadable: [expect.any(String)],
      })

      // And reading it refuses. The empty text is what the SET carries for a
      // file it could not read; handing that back as a body would be a lie an
      // agent then writes its edit against — which is exactly what
      // `write_document`'s own gate refuses for the same file.
      const refused = await call(client, "read_document", { file: "torn.md" })
      expect(refused.isError).toBe(true)
      expect(refused.structured).toMatchObject({ kind: "validation" })
      expect(findingsOf(refused.structured)).toBeArrayOfSize(1)

      // The same file at the write verb, refused by the same rule — one fact,
      // two verbs, and neither of them touching a file nobody read.
      const write = await call(client, "write_document", { file: "torn.md", text: "x" })
      expect(write.isError).toBe(true)
      expect(write.structured).toMatchObject({ kind: "validation" })
    },
    new Set(["torn.md"]),
  )
})

// ── writing ────────────────────────────────────────────────────────────

/**
 * A subtree BETWEEN two outlines, through the tool an agent actually calls —
 * the half of `move-across-outlines` no planner test can reach, because what is
 * claimed here is that the widened schema is what the FACE advertises and that
 * both files go through one write gate onto the disk.
 *
 * The corpus points at what moves from the other outline, on purpose: `shed`
 * is a placement of `install` and `fence` waits on it. If this were the
 * recreation it used to have to be — capture a copy under fresh ids, trash the
 * original — both of those would be naming ids nothing declares, and the set
 * would not validate. It does, and the two records are byte-identical
 * afterwards, which is the promise said as a diff.
 */
test("move_node carries a subtree into another outline, and nothing pointing at it moves", async () => {
  await withTools(
    {
      "house.olai": HOUSE,
      "garden.olai": [
        `{"id":"garden","ord":"a0","title":"the garden"}`,
        `{"id":"fence","parent":"garden","ord":"a0","title":"mend the fence","after":["install"]}`,
        `{"id":"shed","parent":"garden","ord":"a1","mirror":"install"}`,
        "",
      ].join("\n"),
    },
    async ({ client, read }) => {
      const pointing = read("garden.olai") ?? ""

      const answer = await call(client, "move_node", { id: "install", parent: "garden" })
      expect(answer.isError).toBe(false)
      expect(answer.structured).toMatchObject({
        did: "move_node",
        id: "install",
        file: "garden.olai",
      })

      // It LEFT one file and ARRIVED in the other, keeping the id and the mark
      // it was carrying — moving is not editing.
      expect(read("house.olai")).not.toContain(`"id":"install"`)
      expect(read("garden.olai")).toContain(
        `{"id":"install","parent":"garden","ord":"a2","title":"install them","doing":"2026-08-02"`,
      )

      // …and the two records that NAME it are untouched, line for line. That is
      // the whole promise: an id is unique across the served directory, so
      // nothing had to be re-pointed and nothing was.
      const named = pointing.split("\n").filter((one) => one.includes("install"))
      expect(named).toHaveLength(2)
      for (const line of named) expect(read("garden.olai")).toContain(line)
    },
  )
})

/** `file` is the other half of the pair, and it is the top level of that
 *  outline — the same field `add_node` and `untrash_node` take, arriving on the
 *  verb that used to refuse the whole question. */
test("move_node with a `file` lands the subtree at that outline's top level", async () => {
  await withTools(
    { "house.olai": HOUSE, "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}\n` },
    async ({ client, read }) => {
      const answer = await call(client, "move_node", { id: "kitchen", file: "garden.olai" })
      expect(answer.isError).toBe(false)
      // The outline it left holds nothing at all, and is still there.
      expect(read("house.olai")).toBe("")
      const arrived = read("garden.olai") ?? ""
      // The whole subtree, in the order it left, under the ids it always had.
      expect(arrived.split("\n").filter((one) => one !== "").map((one) => JSON.parse(one).id))
        .toEqual(["garden", "kitchen", "demo", "order", "install"])
      expect(arrived).toContain(`{"id":"demo","parent":"kitchen"`)
    },
  )
})

/**
 * The one typed reference a crossing can break, met where an agent meets it —
 * at the GATE, which is the half a `validate` over the planner's records is
 * only a proxy for.
 *
 * `ref` asserts ancestry under a declared root and `node` asserts existence
 * (`@olai/format`'s `wrongRef` / `wrongNode`); an id surviving a move is enough
 * for the second and not for the first. So moving a VARIANT out of its root
 * makes every `ref` at it `bad-prop`, and the whole set is judged before either
 * file is written — which is the law working, and is why this is a refusal with
 * nothing on disk rather than a hole.
 */
test("move_node is refused when it would take a `ref` variant out of its root", async () => {
  await withTools(
    {
      "_olai/Properties.olai":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}\n`,
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
        "",
      ].join("\n"),
      "lanes.olai": [
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}`,
        `{"id":"elsewhere","ord":"a1","title":"somewhere else entirely"}`,
        "",
      ].join("\n"),
    },
    async ({ client, read }) => {
      const agents = read("agents.olai")
      const lanes = read("lanes.olai")

      const out = await call(client, "move_node", { id: "claude", parent: "elsewhere" })
      expect(out.isError).toBe(true)
      // The gate's own shape: the summary says nothing was written, and the
      // validator's rows say WHY, with the `file:line` of the record that can
      // no longer say what it says.
      // THE REFUSAL NAMES ITS BLOCKER. It used to say "would leave the
      // outlines invalid", which named nothing and read as an indictment of a
      // write that was often innocent; the verdict answers which file stops it
      // (`@olai/format`'s `admits`), and the sentence says that.
      expect(out.structured).toMatchObject({
        kind: "validation",
        reason: "`move: Claude` would leave `lanes.olai` invalid, so nothing was written",
      })
      const rows = findingsOf(out.structured)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ file: "lanes.olai", line: 1, code: "bad-prop" })
      expect(String(rows[0]?.["message"])).toContain("`agent`")
      expect(String(rows[0]?.["message"])).toContain("`roster`")
      // NEITHER end was rewritten, which is the whole point of judging both
      // files as one set: the outline it was leaving is untouched too.
      expect(read("agents.olai")).toBe(agents)
      expect(read("lanes.olai")).toBe(lanes)

      // …and moving the ROOT is fine, because the subtree travels and the
      // variants keep the parent they had.
      const root = await call(client, "move_node", { id: "roster", parent: "elsewhere" })
      expect(root.isError).toBe(false)
      expect(read("agents.olai")).toBe("")
      expect(read("lanes.olai")).toContain(`{"id":"claude","parent":"roster"`)
      expect(read("lanes.olai")).toContain(`"custom":{"agent":"claude"}`)
    },
  )
})

/** The one rule the crossing adds, met where an agent meets it: the trash has
 *  two verbs of its own, and this is neither of them. */
test("move_node refuses a trash at either end, toward the verb that does that job", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    await call(client, "trash_node", { id: "demo" })
    const into = await call(client, "move_node", { id: "order", file: "_olai/Trash.olai" })
    expect(into.isError).toBe(true)
    expect(String(into.structured["reason"])).toContain("`trash_node`")

    const out = await call(client, "move_node", { id: "demo", parent: "order" })
    expect(out.isError).toBe(true)
    expect(String(out.structured["reason"])).toContain("`untrash_node`")
  })
})

test("a write through a tool changes the directory", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const answer = await call(client, "set_done", { id: "order" })
    expect(answer.isError).toBe(false)
    expect(answer.structured).toMatchObject({ did: "set_done", id: "order" })
    expect(read("house.olai")).toContain(`"done":${JSON.stringify(STAMP)}`)
  })
})

/**
 * `set_prop`'s CONDITIONAL half, through the agent's own face: the wire half
 * of it is the chip's, the ops half the planner's — what only the tool can
 * prove is that the ask reaches an agent with the field advertised, the
 * refusal arrives as an `isError` with the kind as data, and the message
 * names what the key says NOW, which is the "read again" half of the loop.
 */
test("set_prop with a stale `was` is refused, naming what is there", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const { tools } = await client.listTools()
    const setProp = tools.find((tool) => tool.name === "set_prop")
    // The door advertises the guard — the what-it-is-for, not just the key:
    // this is the sentence that tells a model the read-then-write loop exists.
    expect(setProp?.description).toContain("`was`")
    expect(Object.keys(setProp?.inputSchema.properties ?? {}).sort())
      .toEqual(["id", "key", "value", "was"])

    // `null` expects the key GONE — the add's own condition, and it lands
    // while the key is absent.
    const added = await call(client, "set_prop", { id: "order", key: "stage", value: "review", was: null })
    expect(added.isError).toBe(false)
    expect(read("house.olai")).toContain(`"custom":{"stage":"review"}`)

    // Read, then write back what you read: the loop the guard is for.
    const moved = await call(client, "set_prop", { id: "order", key: "stage", value: "submitted", was: "review" })
    expect(moved.isError).toBe(false)

    // ...and the same write judged against a premise somebody else wrote
    // first: refused, naming the value the key says NOW.
    const stale = await call(client, "set_prop", { id: "order", key: "stage", value: "audit", was: "review" })
    expect(stale.isError).toBe(true)
    expect(String(stale.structured["reason"])).toContain(
      "expected to replace (`review`) — it now says `submitted`, so nothing was written",
    )
    expect(read("house.olai")).toContain(`"custom":{"stage":"submitted"}`)

    // Omitting the guard is unchanged: last-one-wins, which is what a plain
    // `set_prop` has always meant.
    const plain = await call(client, "set_prop", { id: "order", key: "stage", value: "audit" })
    expect(plain.isError).toBe(false)
    expect(read("house.olai")).toContain(`"custom":{"stage":"audit"}`)
  })
})

/**
 * The recurrence, end to end through the agent's own face — the half of MCP
 * parity that is not a schema: writing the rule, reading it back, and the
 * `set_done` that makes the next occurrence.
 *
 * The spawn itself is the planner's and is tested there; what this asserts is
 * that it reaches an AGENT — the new node named in `captured`, the day it
 * landed on in the `nudge`, and the rule gone from the record that was
 * finished, all through the same tool call a person's `Complete` resolves to.
 */
test("set_repeat, read_node and set_done are one recurrence through the tools", async () => {
  await withTools({ "chores.olai": CHORES }, async ({ client, read }) => {
    const set = await call(client, "set_repeat", {
      id: "bins",
      repeat: "every week on monday",
    })
    expect(set.isError).toBe(false)
    expect(read("chores.olai")).toContain(`"repeat":"every week on monday"`)

    // READING it back is the other half of parity: an agent about to change a
    // rule has to be able to see the one that is there.
    expect((await call(client, "read_node", { id: "bins" })).structured)
      .toMatchObject({ id: "bins", date: "2026-08-17", repeat: "every week on monday" })

    const done = await call(client, "set_done", { id: "bins" })
    expect(done.isError).toBe(false)
    const made = done.structured["captured"] as ReadonlyArray<Record<string, unknown>>
    expect(made).toHaveLength(1)
    expect(made[0]).toMatchObject({ title: "put the bins out" })
    expect(String(done.structured["nudge"])).toContain("2026-08-24")

    // The occurrence is on disk, born `todo` at the next date and carrying the
    // rule — and the node that was completed carries neither the rule nor that
    // date any more, which is what "one live head" means on the file itself.
    expect(read("chores.olai"))
      .toContain(`"todo":true,"date":"2026-08-24","repeat":"every week on monday"`)
    expect((await call(client, "read_node", { id: "bins" })).structured)
      .not.toHaveProperty("repeat")
  })
})

/**
 * The two ways a rule can be wrong, met by a live agent — and neither of them
 * lands.
 *
 * They are the FORMAT's per-line rules, so the refusal is the validator's:
 * a `validation` failure carrying its own rows as DATA, with the code, the
 * `file:line` and the grammar quoted, which is what this surface promises an
 * agent instead of prose it would have to parse. Nothing in the planner or in
 * either face repeats the rule — and nothing needs to, because the write gate
 * refuses any write whose own files will not decode (@olai/store's `commit`),
 * which is what stops a set from absorbing one as a `broken` file and
 * answering "done" while the outline drops off every page.
 */
test("a repeat with no date to repeat from is refused, and nothing is written", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "set_repeat", { id: "order", repeat: "every day" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("validation")
    expect(findingsOf(answer.structured)).toMatchObject([
      { file: "house.olai", code: "bad-repeat" },
    ])
    expect(JSON.stringify(answer.structured)).toContain("no `date` to repeat from")
    expect(refusals).toEqual(["repeat: ValidationFailure"])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

test("a rule the grammar does not have is refused, quoting the grammar", async () => {
  await withTools({ "chores.olai": CHORES }, async ({ client, read }) => {
    const answer = await call(client, "set_repeat", { id: "bins", repeat: "every 2 weeks" })
    expect(answer.isError).toBe(true)
    expect(findingsOf(answer.structured)).toMatchObject([
      { file: "chores.olai", line: 1, code: "bad-repeat" },
    ])
    expect(JSON.stringify(answer.structured)).toContain("every week on <weekday>")
    expect(read("chores.olai")).toBe(CHORES)
  })
})

/**
 * The same gate, met through a verb that has nothing to do with recurrence —
 * which is the half of it that is not this feature's. A `date` that is not a
 * date used to LAND: the file stopped parsing, the set absorbed it as broken,
 * and `set_date` answered success while the outline left every page.
 */
test("a date that is not a date is refused too, by the same gate", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const answer = await call(client, "set_date", { id: "order", date: "someday" })
    expect(answer.isError).toBe(true)
    expect(findingsOf(answer.structured)).toMatchObject([
      { file: "house.olai", code: "bad-date" },
    ])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

test("create_outline mints a file through the same tool surface as every other write", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, set }) => {
    const answer = await call(client, "create_outline", {
      file: "inbox.olai",
      seed: { title: "something to capture" },
    })
    expect(answer.structured).toMatchObject({
      did: "create_outline",
      file: "inbox.olai",
      title: "something to capture",
      summary: "capture: something to capture",
    })
    expect(read("inbox.olai")).toContain("something to capture")
    expect(outlinePaths(await set())).toContain("inbox.olai")
  })
})

/**
 * Marking a parent over open work, all the way through — the agent's half of
 * `done-over-open-work` (2026-08-16).
 *
 * It was the refusal this whole error taxonomy was built around; then #90 made
 * it an ordinary write with a nudge; it is a refusal again, and this time for
 * the opposite reason. #90's was structural — a stored mark contradicting a
 * derived one — and this one is about what the mark DOES: done-hiding takes
 * the branch, so a `done` over unfinished work is work off the page. Only
 * `install` counts: `demo` is done, and `order` carries no mark at all, so it
 * is a bullet rather than an unstarted task.
 */
test("marking a parent over unfinished work is refused, with the tasks as data", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "set_done", { id: "kitchen" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("usage")
    expect(String(answer.structured["reason"])).toContain("`install them` (`install`, doing)")
    expect(String(answer.structured["reason"])).not.toContain("order the cabinets")
    expect(refusals).toEqual(["done: UsageFailure"])
    // Nothing was written: a refusal is an answer, never a half-write.
    expect(read("house.olai")).toBe(HOUSE)
  })
})

/**
 * The other door, through the same face: an agent files work under a branch
 * whose `done` has gone stale, and the mark comes off rather than the write
 * being refused — with the news riding the `nudge` field the answer already
 * has, so no agent has to read it out of prose.
 */
test("filing work under a finished branch re-opens it, and the answer says so", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    // `order` is the bullet, so this is the first thing that makes the branch
    // unfinished — and `demo` above it is where the stale mark sits.
    const shut = await call(client, "set_done", { id: "order" })
    expect(shut.isError).toBe(false)

    const filed = await call(client, "add_node", {
      parent: "order",
      title: "chase the delivery date",
      mark: "todo",
    })
    expect(filed.isError).toBe(false)
    expect(String(filed.structured["nudge"])).toContain("`order the cabinets` was marked done")
    expect(String(filed.structured["summary"])).toContain("(reopened: order the cabinets)")
    expect(refusals).toEqual([])
    // The stale mark is off the file, and the new work is in it.
    expect(read("house.olai")).not.toContain(`"done":${JSON.stringify(STAMP)}`)
    expect(read("house.olai")).toContain("chase the delivery date")
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
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "set_done", { id: "nowhere" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("not-found")
    expect(answer.structured["named"]).toBe("nowhere")
    // The observer still fires, and it hangs off OPS rather than off whatever is
    // calling — which is the property that survived the caller being replaced.
    expect(refusals).toEqual(["done: NotFoundFailure"])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

test("arguments that do not fit the tool are refused before any planning", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "set_done", { nope: 1 })
    expect(answer.isError).toBe(true)
    // Refused at the SCHEMA, so the ops layer was never asked and has nothing to
    // report: a malformed call is not a refused write.
    expect(refusals).toEqual([])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

/**
 * The four kinds are FOUR, and each one is either PROVOKED here or signed off
 * as unreachable.
 *
 * `refusal` (`./tools.ts`) spells `kindOf(failure)` into the structured detail,
 * and `kindOf` reads `@olai/format`'s closed table — so a fifth kind is one
 * edit there and a new word arriving at every agent. Keyed by `FailureKind`, so
 * that edit stops HERE: a missing key is a type error, and the only two things
 * that satisfy one are a call that actually produces the kind or a sentence
 * saying why no call can.
 *
 * A list of the four WORDS would not have done it — a fifth kind is satisfied
 * by typing the word in, and the fence would then demand a name rather than a
 * test. This demands the call.
 */
type Provocation = {
  /** The directory to provoke it in, because two of them need different ones. */
  readonly files: Readonly<Record<string, string>>
  readonly tool: string
  readonly args: Record<string, unknown>
}
/** The other way to satisfy a key: say why nothing here can reach it. */
type Unreachable = { readonly unreachable: string }

const PINNED: Record<FailureKind, Provocation | Unreachable> = {
  "not-found": {
    files: { "house.olai": HOUSE },
    tool: "set_done",
    args: { id: "nowhere" },
  },
  usage: {
    files: { "house.olai": HOUSE },
    // A loop is refused NAMING the loop, and being refused for what a write
    // MEANS rather than for what it names is what makes this kind its own.
    tool: "set_after",
    args: { id: "order", add: ["order"] },
  },
  validation: {
    // A set-wide break: nothing loaded, so there is nothing to write against.
    // The rows this comes back with are the subject of the test below.
    files: { "house.olai": HOUSE, "orphan.olai": ORPHAN },
    tool: "set_done",
    args: { id: "order" },
  },
  busy: {
    unreachable:
      "Its only raiser is the write loop giving up after ROUNDS re-plans, each " +
      "overtaken by another writer — a condition a test can only produce by " +
      "standing up a store that rewrites itself continuously, which would be a " +
      "test of the retry rather than of this contract. Reachable in production, " +
      "and deliberately not provoked here.",
  },
}

test("every refusal kind the format declares comes back as an isError result naming it", async () => {
  for (const [kind, pinned] of Object.entries(PINNED)) {
    if ("unreachable" in pinned) continue
    await withTools(pinned.files, async ({ client }) => {
      const answer = await call(client, pinned.tool, pinned.args)
      expect({ kind, isError: answer.isError, said: answer.structured["kind"] })
        .toEqual({ kind, isError: true, said: kind })
    })
  }
})

/**
 * A `validation` refusal, which is the kind whose payload is the whole point.
 *
 * The other three carry a sentence and at most an id. This one carries the
 * VALIDATOR'S OWN ROWS — `file`, `line`, `code`, `message` per finding — which
 * is what lets an agent fix the one line that is wrong instead of re-reading a
 * directory it cannot parse. It is also the only kind whose detail is an array
 * of objects, so it is the only one the schema bridge and `structuredContent`
 * could plausibly flatten on the way out.
 *
 * AND THE SAME ROWS ARRIVE THE OTHER WAY. A refused call is one door onto
 * "what is wrong here"; `surface://cells/errors` is the other, and it is the
 * one the browser draws its banner from. Asserting they are the same rows is
 * the whole of "one surface for browser and agents" at the point where it would
 * actually be felt: an agent and a person looking at a broken directory are
 * looking at one report.
 */
test("a directory that will not load refuses with the validator's own rows", async () => {
  await withTools({ "house.olai": HOUSE, "orphan.olai": ORPHAN }, async ({ client }) => {
    const read = await call(client, "search_nodes", { text: "kitchen" })
    expect(read.isError).toBe(true)
    expect(read.structured["kind"]).toBe("validation")

    // A WRITE refuses the same way, and that is the point of the kind: a
    // refused write and a broken file on disk are explained by one report.
    const write = await call(client, "set_done", { id: "order" })
    expect(write.isError).toBe(true)
    expect(write.structured["kind"]).toBe("validation")

    // The rows themselves, as DATA — situated, not a sentence to parse.
    const rows = findingsOf(read.structured)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toMatchObject({ file: "orphan.olai" })
    for (const row of rows) {
      expect(typeof row["code"]).toBe("string")
      expect(typeof row["message"]).toBe("string")
      expect(typeof row["line"]).toBe("number")
    }
    expect(findingsOf(write.structured)).toEqual(rows)

    // And the resource an agent can WATCH says the same thing, in the same
    // vocabulary, at the same instant — which is what one surface means.
    const answer = await client.readResource({ uri: "surface://cells/errors" })
    const part = answer.contents[0]
    if (part === undefined || !("text" in part)) {
      throw new Error("surface://cells/errors: expected one text part")
    }
    expect(JSON.parse(part.text as string)).toEqual({ findings: rows })
  })
})

test("a tool that does not exist is an error result, not a protocol error", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
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
  await withTools({ "house.olai": HOUSE }, async ({ client, read, set }) => {
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

    const text = read("house.olai") ?? ""
    expect(text.split("\n").filter((line) => line !== "")).toHaveLength(8)
    expect(text).toContain(`"todo":true`)
    expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)

    // The tree is a tree: `measure` hangs off `shelves`, which hangs off the
    // node the call named.
    const nodes = new Map(
      recordsOf(await set()).map((located) => [located.node.id, located.node]),
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
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
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
          .toEqual([
            // Declared PURELY to be refused: `after` means the sibling anchor
            // at a capture's top level and nothing below it, and an Effect
            // struct drops a key it does not declare — so a child spelling it
            // for the edge list would lose the dependency under a call that
            // reported success. The planner refuses it by name instead.
            "after",
            "children",
            "date",
            "desc",
            "id",
            "mark",
            // The three `olai-batch-verbs` added: a captured node carries what
            // it POINTS AT and what it KNOWS, at every level, so a subtree
            // arrives with its edges and its facts rather than with thirteen
            // calls behind it.
            "props",
            "see",
            "title",
            "waitsOn",
          ])
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
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const listed = (await call(client, "list_outlines", {})).structured

    const outlines = listed["outlines"] as ReadonlyArray<{ file: string }>
    expect(outlines[0]?.file).toBe("house.olai")

    const added = await call(client, "add_node", {
      file: outlines[0]?.file,
      title: "water the plants",
    })
    expect(added.isError).toBe(false)
    expect(read("house.olai")).toContain("water the plants")
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
    { "house.olai": HOUSE, "now.olai": LEDGER },
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
        file: "now.olai",
        summary: "mirror: order the cabinets",
      })
      // Four fields, and no title, mark or note anywhere on the line.
      expect(read("now.olai")).toContain(
        `{"id":"now-order","parent":"now","ord":"a0","mirror":"order"}`,
      )
      // The node it shows is not rewritten at all.
      expect(read("house.olai")).toBe(HOUSE)

      // …and it is FINDABLE, which is what makes retiring it possible in a
      // session that did not place it: mirrors are left out of search and out of
      // every child list, so the node is where you ask.
      const node = (await call(client, "read_node", { id: "order" })).structured
      expect(node["mirrors"]).toEqual([
        { id: "now-order", file: "now.olai", line: 2, parent: "now" },
      ])

      const retired = await call(client, "remove_mirror", { id: "now-order" })
      expect(retired.isError).toBe(false)
      expect(retired.structured).toMatchObject({
        did: "remove_mirror",
        summary: "unmirror: order the cabinets",
      })
      expect(read("now.olai")).toBe(LEDGER)
      expect(read("house.olai")).toBe(HOUSE)
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
    { "house.olai": HOUSE, "now.olai": LEDGER },
    async ({ client }) => {
      await call(client, "add_mirror", { target: "order", parent: "now", id: "now-order" })
      await call(client, "add_mirror", { target: "install", parent: "now", id: "now-install" })

      const now = (await call(client, "read_node", { id: "now" })).structured
      expect(now["children"]).toEqual([])
      expect(now["placed"]).toEqual([
        {
          id: "now-order",
          file: "now.olai",
          line: 2,
          parent: "now",
          shows: {
            id: "order",
            title: "order the cabinets",
            file: "house.olai",
            line: 3,
            path: ["Kitchen remodel"],
          },
        },
        {
          id: "now-install",
          file: "now.olai",
          line: 3,
          parent: "now",
          shows: {
            id: "install",
            title: "install them",
            file: "house.olai",
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
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "remove_mirror", { id: "order" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("usage")
    expect(String(answer.structured["reason"])).toContain("trash_node")
    expect(refusals).toEqual(["unmirror: UsageFailure"])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

/** The trash, both ways, on the agent's face: `trash_node` puts a subtree
 *  away and `untrash_node` brings it back where the recorded chain says it
 *  came from — the op `parity-unarchive` was owed on BOTH faces at once. */
test("untrash_node takes back what trash_node put away", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const away = await call(client, "trash_node", { id: "order" })
    expect(away.isError).toBe(false)
    expect(read("house.olai")).not.toContain(`"id":"order"`)
    expect(read("_olai/Trash.olai")).toContain(`"id":"order"`)

    const back = await call(client, "untrash_node", { id: "order" })
    expect(back.isError).toBe(false)
    expect(back.structured).toMatchObject({
      summary: "untrash: order the cabinets",
      file: "house.olai",
    })
    // Back under its own parent — the chain of ancestor titles, followed — and
    // the emptied scaffold tidied away behind it.
    expect(read("house.olai")).toContain(`"id":"order","parent":"kitchen"`)
    expect(read("_olai/Trash.olai")).toBe("")
  })
})

/**
 * The archive's exemption, and where it ends — the hole grok found in #207,
 * driven through the face an agent actually talks to.
 *
 * Both gates skip archived writes, deliberately: work put away is over. So the
 * contradiction can be MINTED in there (step 2 below is refused nowhere), and
 * `untrash_node` is the write that would otherwise carry it into the live
 * set — where a `done` over a `todo` is exactly the state that vanishes from
 * the page. It comes back out repaired, and the answer says which mark it took
 * off.
 */
test("a done mark minted in the archive is re-opened when the subtree comes back", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    // `install` is `doing`, so `kitchen` cannot be marked done in the live set
    // — that is door one, and the refusal is asserted above. Put it away and
    // the same write goes through.
    const away = await call(client, "trash_node", { id: "install" })
    expect(away.isError).toBe(false)
    const shut = await call(client, "set_done", { id: "install" })
    expect(shut.isError).toBe(false)
    expect(read("_olai/Trash.olai")).toContain(`"id":"install"`)

    // Now the branch is done in the trash with nothing unfinished under it, so
    // give it something: a task filed under it, still inside the archive.
    const filed = await call(client, "add_node", {
      parent: "install",
      title: "chase the fitter",
      mark: "todo",
    })
    expect(filed.isError).toBe(false)
    // Nothing was re-opened in there: the archive is exempt at both doors.
    expect(String(filed.structured["nudge"] ?? "")).not.toContain("marked done")

    const back = await call(client, "untrash_node", { id: "install" })
    expect(back.isError).toBe(false)
    expect(String(back.structured["nudge"]))
      .toContain("`install them` was marked done over work that is not finished")
    expect(String(back.structured["summary"])).toContain("(reopened: install them)")
    // The mark is off in the live file, and the work it was hiding is on the
    // page with it.
    expect(read("house.olai")).toContain("chase the fitter")
    expect(read("house.olai")).not.toContain(`"id":"install","parent":"kitchen","ord":"a2","done"`)
  })
})

/**
 * The trash's THIRD verb on the agent's face, and the only destructive one in
 * this whole surface: `empty_trash`.
 *
 * Driven end to end because that is where the two things worth pinning are —
 * that a no-`op` argument list reaches the planner as the right request, and
 * that what is refused is refused BEFORE anything is written. The refusal here
 * is the one that matters: `order` is archived while a live `see` names it, so
 * deleting it would leave that edge pointing at nothing, and the archive is
 * still on disk afterwards, byte for byte.
 */
test("empty_trash deletes the pile, and refuses while something still points into it", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    // A live row that names what is about to be put away. Ids move with a node
    // when it is archived, so this edge goes on resolving INTO the archive —
    // which is exactly what makes the pile undeletable.
    const linked = await call(client, "set_see", { id: "demo", add: ["order"] })
    expect(linked.isError).toBe(false)
    const away = await call(client, "trash_node", { id: "order" })
    expect(away.isError).toBe(false)
    const filled = read("_olai/Trash.olai")
    expect(filled).toContain(`"id":"order"`)

    const held = await call(client, "empty_trash", { file: "_olai/Trash.olai" })
    expect(held.isError).toBe(true)
    expect(held.structured["kind"]).toBe("usage")
    expect(String(held.structured["reason"])).toContain("`demo`")
    expect(String(held.structured["reason"])).toContain("`see`")
    // Nothing was written: the gate plans before it renames.
    expect(read("_olai/Trash.olai")).toBe(filled)
    expect(refusals).toEqual(["empty: UsageFailure"])

    // Re-point the edge and the pile deletes — the way through the refusal
    // named, taken.
    const freed = await call(client, "set_see", { id: "demo", remove: ["order"] })
    expect(freed.isError).toBe(false)
    const gone = await call(client, "empty_trash", { file: "_olai/Trash.olai" })
    expect(gone.isError).toBe(false)
    expect(gone.structured).toMatchObject({
      summary: "empty: _olai/Trash.olai (3 records)",
      file: "_olai/Trash.olai",
      did: "empty_trash",
    })
    expect(read("_olai/Trash.olai")).toBe("")
    // …and the live outline is untouched: the blast radius is one file.
    expect(read("house.olai")).toContain(`"id":"kitchen"`)
  })
})

test("empty_trash refuses a live outline, and an archive with nothing in it", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const live = await call(client, "empty_trash", { file: "house.olai" })
    expect(live.isError).toBe(true)
    expect(String(live.structured["reason"])).toContain("is not the trash")
    expect(read("house.olai")).toBe(HOUSE)

    // The state a put-back leaves: the file stands, holding nothing. Emptying
    // it is refused rather than committed as a diff-less write.
    await call(client, "trash_node", { id: "order" })
    await call(client, "untrash_node", { id: "order" })
    expect(read("_olai/Trash.olai")).toBe("")
    const twice = await call(client, "empty_trash", { file: "_olai/Trash.olai" })
    expect(twice.isError).toBe(true)
    expect(String(twice.structured["reason"])).toContain("already empty")
  })
})

/**
 * TWO PILES AND AN EDGE BETWEEN THEM, on the agent's face — the topology grok
 * probed the planner with (#250), driven end to end because that is where the
 * old shape actually broke: the browser sent one `empty` per archive inside an
 * `apply`, and the same two piles refused in path order and landed in the
 * reverse.
 *
 * Named together, they are one call and the order of the list means nothing.
 */
test("empty_trash over two piles judges the edge between them as a record that goes", async () => {
  await withTools({
    "house.olai": HOUSE,
    "garden/plot.olai": [
      `{"id":"beds","ord":"a0","title":"the beds"}`,
      `{"id":"quote","parent":"beds","ord":"a0","title":"a quote","see":["order"]}`,
      "",
    ].join("\n"),
  }, async ({ client, read }) => {
    // `quote` names `order`, and both are about to be archived into DIFFERENT
    // archives — which is exactly the edge that used to read as a holder.
    expect((await call(client, "trash_node", { id: "order" })).isError).toBe(false)
    expect((await call(client, "trash_node", { id: "beds" })).isError).toBe(false)
    expect(read("_olai/Trash.olai")).toContain(`"id":"order"`)
    expect(read("_olai/Trash.olai")).toContain(`"id":"quote"`)

    const gone = await call(client, "empty_trash", {
      file: "_olai/Trash.olai",
    })
    expect(gone.isError).toBe(false)
    expect(String(gone.structured["summary"]))
      .toBe("empty: _olai/Trash.olai (6 records)")
    expect(read("_olai/Trash.olai")).toBe("")
  })
})

/** The same edge, with only ONE of the two piles named: what is inside the
 *  emptying is what the call names, so the record in the archive nobody named
 *  is outside it and holds — the rule read from the other side. */
test("empty_trash still refuses for a namer in a leftover Archive.olai", async () => {
  await withTools({
    "house.olai": HOUSE,
    "Archive.olai": `{"id":"quote","ord":"a0","title":"a leftover quote","see":["order"]}`,
  }, async ({ client, read }) => {
    await call(client, "trash_node", { id: "order" })
    const held = await call(client, "empty_trash", { file: "_olai/Trash.olai" })
    expect(held.isError).toBe(true)
    expect(String(held.structured["reason"])).toContain("`quote`")
    expect(read("_olai/Trash.olai")).toContain(`"id":"order"`)
    expect(read("Archive.olai")).toContain(`"id":"quote"`)
  })
})

/** `was` — the count somebody was shown, checked against the set the write is
 *  judged on. What it closes is the retry's window: a re-plan against a newer
 *  snapshot silently widens this write. */
test("empty_trash with a stale `was` deletes nothing and names both counts", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    await call(client, "trash_node", { id: "order" })
    const filled = read("_olai/Trash.olai")

    const stale = await call(client, "empty_trash", { file: "_olai/Trash.olai", was: 1 })
    expect(stale.isError).toBe(true)
    expect(String(stale.structured["reason"])).toContain("held 1 record when this was asked for")
    expect(read("_olai/Trash.olai")).toBe(filled)

    const right = await call(client, "empty_trash", { file: "_olai/Trash.olai", was: 3 })
    expect(right.isError).toBe(false)
    expect(read("_olai/Trash.olai")).toBe("")
  })
})

/** The other half of ledger-complete: a dependency, written from the node that
 *  waits, read back off the node, and refused when it would close a loop. */
test("set_after writes a dependency, and a loop is refused naming it", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const wired = await call(client, "set_after", { id: "install", add: ["order"] })
    expect(wired.isError).toBe(false)
    expect(wired.structured).toMatchObject({ summary: "after: install them" })
    expect(read("house.olai")).toContain(`"after":["order"]`)

    // Read back off the node, so the next call can remove one by id.
    expect((await call(client, "read_node", { id: "install" })).structured)
      .toMatchObject({ after: ["order"] })

    const loop = await call(client, "set_after", { id: "order", add: ["install"] })
    expect(loop.isError).toBe(true)
    expect(loop.structured["kind"]).toBe("usage")
    expect(String(loop.structured["reason"])).toContain("`order` → `install` → `order`")
  })
})

/**
 * And the DERIVED half of that graph, read back off the node — what an agent
 * can now see that only a page could before.
 *
 * Not a second test of the derivation: that is one function in
 * `@olai/format` and `@olai/ops`' `query.test.ts` pins the field against it.
 * What is only true HERE is that the value CROSSES. A field the ops layer
 * produces and the answer schema does not declare type-checks clean everywhere
 * and is dropped in silence on the way out — which has happened once already,
 * to a search field the palette's encoder ate (`@olai/format`'s `searching.ts`
 * header). So this reads the structured answer an agent actually receives.
 *
 * TWO assertions, and the second is not the rule read again: what an optional
 * field does when it empties is a WIRE question of its own — `Schema.optionalKey`
 * has to drop the key rather than send `[]`, which is the promise the four
 * fields above it make and the one a browser and an agent both read as
 * "nothing". Which marks block and which do not is the derivation's, and is
 * pinned one layer down against the function that decides it.
 */
test("read_node says what a node is waiting on, and drops the field when it clears", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    await call(client, "set_after", { id: "install", add: ["order"] })
    await call(client, "set_todo", { id: "order" })

    // The blocker arrives SITUATED — with its title, its place, its ancestors
    // and the mark that makes it one — not as the id the record already holds.
    expect((await call(client, "read_node", { id: "install" })).structured["blockedBy"])
      .toEqual([{
        id: "order",
        title: "order the cabinets",
        file: "house.olai",
        line: 3,
        path: ["Kitchen remodel"],
        status: "todo",
      }])

    // Finishing it clears the way, and the field GOES rather than emptying.
    await call(client, "set_done", { id: "order" })
    expect((await call(client, "read_node", { id: "install" })).structured)
      .not.toHaveProperty("blockedBy")
  })
})

// ── the three batching verbs, through the client ───────────────────────

/**
 * What an agent actually receives for a batch: one answer, one revision, and —
 * when a batch is refused — an `isError` naming which op it was.
 *
 * The ops layer's own tests prove the fold decides what the single verbs decide
 * (`@olai/ops`' `batch.test.ts`). What is only true here is the SHAPE the agent
 * sees: the adapter's schema bridge accepted a union inside an array, the
 * discriminator each op carries survived the round trip, and the refusal arrives
 * as structured detail rather than as prose to parse.
 */
test("`apply` runs a list of ops as one write, and names the op that refused", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const done = await call(client, "apply", {
      ops: [
        { op: "done", id: "order" },
        { op: "prop", id: "install", key: "pr", value: "https://x/1" },
        { op: "add", parent: "kitchen", id: "worktop", title: "fit the worktop" },
        // An op naming what an op three lines above it created — the property
        // the fold exists for.
        { op: "after", id: "worktop", add: ["install"] },
      ],
    })
    expect(done.isError).toBe(false)
    expect(done.structured["did"]).toBe("apply")
    expect(String(done.structured["summary"])).toContain("apply: 4 ops")
    // One revision for the whole run: the load is 1, so this is 2.
    expect(done.structured["rev"]).toBe(2)
    expect(done.structured["captured"]).toEqual([{ id: "worktop", title: "fit the worktop" }])

    const text = read("house.olai") ?? ""
    expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
    expect(text).toContain(`"custom":{"pr":"https://x/1"}`)
    expect(text).toContain(`"after":["install"]`)

    // And a batch that cannot finish finishes nothing.
    const before = read("house.olai")
    const stopped = await call(client, "apply", {
      ops: [
        { op: "title", id: "order", title: "renamed" },
        { op: "done", id: "nowhere" },
      ],
    })
    expect(stopped.isError).toBe(true)
    expect(stopped.structured["kind"] as FailureKind).toBe("not-found")
    expect(String(stopped.structured["reason"])).toContain("`ops[1]` (`done`)")
    expect(stopped.structured["named"]).toBe("nowhere")
    expect(read("house.olai")).toBe(before)
    expect(refusals).toEqual(["apply: NotFoundFailure"])
  })
})

test("`update` writes several fields of one node, and the mark goes last", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const written = await call(client, "update", {
      id: "order",
      title: "order the cabinets #kitchen",
      desc: "from the joiner",
      props: { pr: "https://x/1", agent: "claude-opus" },
      mark: "done",
    })
    expect(written.isError).toBe(false)
    expect(written.structured["title"]).toBe("order the cabinets #kitchen")
    expect(String(written.structured["summary"]))
      .toBe("update: order the cabinets #kitchen (title, note, `pr`, `agent`, done)")
    expect(written.structured["rev"]).toBe(2)

    const text = read("house.olai") ?? ""
    expect(text).toContain(`"custom":{"agent":"claude-opus","pr":"https://x/1"}`)
    expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)

    // The properties MERGE: a second call naming one key leaves the other
    // standing, and `null` takes one off.
    const merged = await call(client, "update", { id: "order", props: { pr: null } })
    expect(merged.isError).toBe(false)
    expect(read("house.olai")).toContain(`"custom":{"agent":"claude-opus"}`)

    // The mark is applied after the edge, so this pair is refused — `install`
    // is `doing`, which is unfinished work standing in the way.
    const blocked = await call(client, "update", {
      id: "kitchen",
      mark: "doing",
      after: ["install"],
    })
    expect(blocked.isError).toBe(true)
    expect(blocked.structured["kind"] as FailureKind).toBe("usage")
    expect(String(blocked.structured["reason"])).toContain("it cannot start yet")
    // Neither half landed: `kitchen` has no edge and no mark.
    expect(read("house.olai")).not.toContain(`"after":["install"]`)
  })
})

test("a capture arrives with its edges and its properties, pointing forward", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const captured = await call(client, "add_node", {
      parent: "kitchen",
      title: "worktop",
      props: { agent: "claude-opus" },
      children: [
        { id: "cut", title: "cut it", waitsOn: ["measure"], see: ["order"] },
        { id: "measure", title: "measure up" },
      ],
    })
    expect(captured.isError).toBe(false)
    expect(captured.structured["rev"]).toBe(2)
    const text = read("house.olai") ?? ""
    expect(text).toContain(`"after":["measure"]`)
    expect(text).toContain(`"see":["order"]`)
    expect(text).toContain(`"custom":{"agent":"claude-opus"}`)

    // The refusals are the edge verbs' own, met at capture time.
    const loop = await call(client, "add_node", {
      parent: "kitchen",
      title: "ring",
      children: [
        { id: "x", title: "x", waitsOn: ["y"] },
        { id: "y", title: "y", waitsOn: ["x"] },
      ],
    })
    expect(loop.isError).toBe(true)
    expect(String(loop.structured["reason"])).toContain("closes a loop")

    const shadowed = await call(client, "add_node", {
      parent: "kitchen",
      title: "shadow",
      props: { done: "yesterday" },
    })
    expect(shadowed.isError).toBe(true)
    expect(String(shadowed.structured["reason"]))
      .toContain("a node already says `done` with a field of its own")
  })
})

/**
 * The two batching verbs advertise schemas an MCP host can actually read.
 *
 * `apply` carries a UNION of sixteen request schemas inside an array, which is
 * the shape most likely to compile to a `$ref` into a `$defs` pool — and the
 * adapter inlines local refs and STRIPS the pool, so a ref it could not inline
 * would survive as a pointer into nothing and take the whole tool down. That is
 * the same fence `add_node`'s unrolled `children` has, over the other schema
 * this feature added.
 */
test("`apply` and `update` advertise finite schemas with no $ref", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    const apply = tools.find((tool) => tool.name === "apply")
    expect(JSON.stringify(apply?.inputSchema)).not.toContain("$ref")
    expect(JSON.stringify(apply?.inputSchema)).not.toContain("$defs")
    // The `op` the tool's own NAME decides is subtracted from the top level, as
    // it is for every write — and the ops INSIDE keep theirs, because that is
    // what the agent picks a verb with.
    expect(Object.keys(apply?.inputSchema.properties ?? {})).toEqual(["ops"])

    // The verbs the union offers, read off each arm's own `op` rather than
    // grepped out of the JSON: `done` appears in `add`'s `mark` enum too, so a
    // substring test would say yes to a verb that has no arm at all.
    const arms = (apply?.inputSchema as unknown as {
      properties: { ops: { items: { anyOf: ReadonlyArray<Record<string, never>> } } }
    }).properties.ops.items.anyOf
    const verbs = arms.flatMap((one) =>
      ((one as unknown as {
        properties: { op: { enum: ReadonlyArray<string> } }
      }).properties.op.enum)
    ).sort()
    expect(verbs).toEqual([
      "add",
      "after",
      "cancelled",
      "date",
      "desc",
      "doing",
      "done",
      "duplicate",
      "empty",
      "merge",
      "mirror",
      "move",
      "prop",
      "repeat",
      "see",
      "split",
      "title",
      "todo",
      "trash",
      "unmirror",
      "untrash",
      "update",
    ])
    // The four that are deliberately not batchable: the three writes whose
    // subject is a FILE, and `apply` itself.
    for (const op of ["create", "create-doc", "doc", "apply"]) {
      expect(verbs).not.toContain(op)
    }

    const update = tools.find((tool) => tool.name === "update")
    expect(JSON.stringify(update?.inputSchema)).not.toContain("$ref")
    expect(Object.keys(update?.inputSchema.properties ?? {}).sort())
      .toEqual([
        "after",
        "date",
        "desc",
        "id",
        "mark",
        "props",
        "repeat",
        "title",
        "was",
      ])
  })
})

/**
 * The two refusals this feature owed a live agent, through the real client.
 *
 * Both are the same failure mode — an Effect struct DROPS a key it does not
 * declare — met from the two directions this PR opened it: a `was` an agent
 * carries over from `set_title`, and an `after` an agent writes on a captured
 * child because the anchor one level up spells it that way. Neither may be
 * silently swallowed, so both are declared purely to be refused, and this is
 * the level at which "declared" has to be true: the adapter's schema bridge is
 * what decides whether the key survives the wire.
 */
test("a `was` and a bent `after` reach the planner instead of vanishing", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    // The conditional an agent migrating from `set_title` brings with it. It is
    // CHECKED — this one holds, so the write lands.
    const held = await call(client, "update", {
      id: "order",
      title: "order the walnut cabinets",
      was: { title: "order the cabinets" },
    })
    expect(held.isError).toBe(false)
    expect(read("house.olai")).toContain("order the walnut cabinets")

    // …and this one does not, so nothing lands — where before the field would
    // have been dropped and the write would have gone through regardless.
    const stale = await call(client, "update", {
      id: "order",
      title: "renamed again",
      desc: "a note",
      was: { title: "order the cabinets" },
    })
    expect(stale.isError).toBe(true)
    expect(stale.structured["kind"] as FailureKind).toBe("usage")
    expect(String(stale.structured["reason"])).toContain("has been retitled since")
    expect(read("house.olai")).not.toContain("renamed again")
    expect(read("house.olai")).not.toContain("a note")

    // A condition on a field this call does not write is a mis-typed call.
    const idle = await call(client, "update", {
      id: "order",
      desc: "x",
      was: { title: "anything" },
    })
    expect(idle.isError).toBe(true)
    expect(String(idle.structured["reason"])).toContain("`was.title`")

    // And the bent word on a captured child, refused rather than dropped.
    const bent = await call(client, "add_node", {
      parent: "kitchen",
      title: "lane",
      children: [{ title: "cut", after: ["order"] }],
    })
    expect(bent.isError).toBe(true)
    expect(String(bent.structured["reason"])).toContain("write `waitsOn` instead")
    expect(read("house.olai")).not.toContain(`"title":"lane"`)
  })
})

// ── capture, the one PLAN arm ──────────────────────────────────────────
//
// These came down from `capture.test.ts` when `POST /capture` was retired.
// They were driven through a real HTTP door because that was the only way to
// reach the verb; the verb is a tool now, so they are asked of the tool, and
// what an agent calls and what `olai surface capture` calls are the same thing
// being asserted here. The wire half of that file — the status table, the CSRF
// gate, the method arm, the identity header — went with the door.

/** The capture that ended up in the set, whatever file it landed in. */
const captured = (set: OutlineSet, title: string) => {
  const found = recordsOf(set)
    .map((one) => one.node)
    .find((one) => !("mirror" in one) && one.title === title)
  if (found === undefined || "mirror" in found) throw new Error(`no capture titled ${title}`)
  return found
}

test("a capture lands in a minted inbox, dated and attributed", async () => {
  await withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    const answered = await call(client, "capture", {
      title: "the thread about cabinets",
      text: "worth a reply",
    })
    expect(answered.isError).toBe(false)
    // The directory had never captured, so this write MINTED the inbox — the
    // convention's own answer, not a path this tool spells.
    expect(answered.structured["file"]).toBe("_olai/Inbox.olai")
    expect(answered.structured["did"]).toBe("capture")

    const node = captured(await set(), "the thread about cabinets")
    // The note is the text, verbatim, and nothing under it. The `url` field
    // that used to add a markdown autolink below the comment is gone with the
    // props map (ruled, human 2026-08-23) — a capture is a title and a note.
    expect(node.desc ?? "").toBe("worth a reply")
    // DATED, which is the half a capture made while nobody was looking needs:
    // it is on the day's journal page as well as in the inbox.
    expect(typeof node.date).toBe("string")
  })
})

test("…and into the inbox the directory already keeps, wherever that is", async () => {
  await withTools(
    { "a.olai": HOUSE, "notes/inbox.olai": "" },
    async ({ client, set }) => {
      const answered = await call(client, "capture", { title: "buy milk" })
      expect(answered.isError).toBe(false)
      expect(answered.structured["file"]).toBe("notes/inbox.olai")
      // Nothing was minted beside it.
      expect([...outlinePaths(await set())].sort()).toEqual(["a.olai", "notes/inbox.olai"])
    },
  )
})

test("a door that knows nobody writes no attribution, rather than a false one", () => {
  // The default `withTools` face passes no login — which is what a direct
  // loopback call to `/mcp` is, and what a `just run` with no proxy in front of
  // it is. The ruling: such a door OMITS the property rather than inventing one.
  return withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    await call(client, "capture", { title: "unattributed" })
    const node = captured(await set(), "unattributed")
    expect("custom" in node ? node.custom : undefined).toBeUndefined()
  })
})

test("…and a door that DOES know somebody writes it on", async () => {
  // The other half of the same ruling, and the half a doc makes a promise about
  // (`prop:captured-by=…` finds what you captured). The login is the one the
  // reverse proxy injected on the request (`../mcp/route.ts`), so a capture
  // through the tailnet is attributed to whoever the proxy said made it.
  await withTools(
    { "a.olai": HOUSE },
    async ({ client, set }) => {
      await call(client, "capture", { title: "attributed" })
      const node = captured(await set(), "attributed")
      expect("custom" in node ? node.custom : undefined).toEqual({
        "captured-by": "srid",
      })
    },
    new Set(),
    "srid",
  )
})

test("a client cannot say who captured this — there is nowhere to say it", async () => {
  await withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    // This used to be a REFUSAL — a guard reading the props map for
    // `captured-by`, plus a second case for a key that was only the same key
    // after the write planner trimmed it. Both went with the map: a capture
    // takes a title and a note, so there is no field an attribution could be put
    // in, and the rule is the schema's rather than a check this verb wrote.
    //
    // WHAT A CLIENT THAT SENDS ONE ANYWAY GETS is the point of this case. The
    // decode strips a property the tool does not declare, so the call succeeds —
    // and what it succeeds at is a capture with NO attribution, never the
    // forged one. A door that knew somebody would have written that somebody
    // (the case above); this door knows nobody, so the row carries nothing. The
    // outcome the old guard protected is reached by there being nothing to
    // guard.
    const answered = await call(client, "capture", {
      title: "x",
      props: { "captured-by": "someone@else" },
    })
    expect(answered.isError).toBe(false)
    const node = captured(await set(), "x")
    expect("custom" in node ? node.custom : undefined).toBeUndefined()
  })
})

test("an empty capture is refused in the ops layer's own words", async () => {
  await withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    const answered = await call(client, "capture", { title: "" })
    expect(answered.isError).toBe(true)
    // A capture of nothing is refused by the write planner, which is the same
    // sentence an agent's `add_node` gets — this tool adds no rule of its own.
    expect(outlinePaths(await set())).toEqual(["a.olai"])
  })
})

/**
 * CONCURRENT FIRST CAPTURES all land — the review finding, as the case that
 * produced it, and the reason the plan arm re-resolves.
 *
 * `captureInto` picks `create` for a directory with no inbox, and the ops layer
 * re-plans the request it was handed rather than re-making that choice. So
 * before the arm resolved a second time, simultaneous captures into a fresh
 * directory answered one success and a row of refusals — and each refusal told
 * the caller to use `add_node`, which is advice the `capture` TOOL cannot take:
 * it resolves one request and runs it, and choosing a different verb is not
 * something a caller of this verb can do.
 *
 * SIX rather than two, because one loser proves less than a handful: the arm
 * this exercises is the one taken by every call that read the set before the
 * winner published.
 */
test("several captures at once into a directory with no inbox all land", async () => {
  await withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    const many = [1, 2, 3, 4, 5, 6]
    const answered = await Promise.all(
      many.map((n) => call(client, "capture", { title: `capture ${n}` })),
    )
    expect(answered.map((one) => one.isError)).toEqual(many.map(() => false))

    // …and every one of them is really in the file, not merely answered for.
    const titles = recordsOf(await set())
      .map((one) => one.node)
      .flatMap((one) => "mirror" in one ? [] : [one.title])
    for (const n of many) expect(titles).toContain(`capture ${n}`)
  })
})
