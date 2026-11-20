import { refusalIn } from "@olai/surface"
import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { capabilitiesOver, CONTENT_ROWS } from "../capabilities.testlib.ts"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import {
  type FailureKind,
  inboxHeldOf,
  NO_KINDS,
  type OutlineSet,
  outlinePaths,
  verdictOf,
} from "@olai/format"
import { readingOf, recordsOf } from "@olai/format/testlib"
import {
  codecFor,
  make as makeOps,
  type Store as OutlineStore,
  type Tool,
} from "@olai/ops"
import { STAMP, steady } from "@olai/ops/testlib"
import * as Store from "@olai/store"
import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, Result } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { watchFault } from "../fault.ts"
import { hostname } from "../hostname.ts"
import { bind } from "../runtime.ts"
import { clientsFor, siblingsOf, type Row } from "olai-plugin-mcp/testlib"
import { serveFace } from "olai-plugin-mcp/testlib"
import { bespokeFrom } from "olai-plugin-mcp/testlib"

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","doing":"2026-08-02"}`,
  "",
].join("\n")

const CHORES = [
  `{"id":"bins","ord":"a0","title":"put the bins out","todo":true,"date":"2026-08-17"}`,
  "",
].join("\n")

const ORPHAN = `{"id":"stray","parent":"kitchn","ord":"a0","title":"a lost row"}\n`

interface Fixture {
  readonly client: Client
  readonly root: string
  readonly read: (file: string) => string | null
  readonly set: () => Promise<OutlineSet>
  readonly refusals: ReadonlyArray<string>
}

const withTools = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Promise<A>,
  unreadable: ReadonlySet<string> = new Set(),
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
    const ops = makeOps({claims: { current: TEST_CLAIMS }, format: "outline-olai",
      store,
      root,
      context: steady(),
      onRefusal: (request, failure) =>
        Effect.sync(() => {
          refusals.push(`${request.op}: ${failure._tag}`)
        }),
    })

    const wired = yield* bind({
      hostname: hostname(),
      startedAt: "2026-08-29T09:31:00.000Z",
      plugins: yield* capabilitiesOver(store, ops, root, { rows: [...CONTENT_ROWS, "search", "git"], definitions: true }),
    })
    const runtime = yield* watchFault(wired.bound)
    yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const rows = (): ReadonlyArray<Row> =>
      wired.bound.rows.map(row => ({ name: row.name, surface: row.surface, resources: row.resources ?? {}, tools: row.tools ?? [], charter: row.charter }))
    const panel = () => clientsFor(rows(), () => ({ group: wired.bound.group, handlers: wired.bound.handlers, writes: wired.bound.writes, expose: wired.faces.agent }), { writer: "mcp" })
    yield* serveFace({
      siblings: siblingsOf(rows(), row => bespokeFrom(row.name, row.tools as ReadonlyArray<Tool>, rows, {
        login: () => login,
        root,
        vintage: Effect.map(store.read("verified"), (aged) => aged.vintage),
        doorAt: panel,
        record: (request) => ops.commit(request, "mcp"),
        push: ops.push,
      })),
      client: panel,
      rows,
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
        root,
        read: (file) => {
          const at = path.join(root, file)
          return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
        },
        set: () =>
          Effect.runPromise(
            Effect.map(Effect.map(store.read("cheap"), (aged) => aged.snapshot), (snapshot) => {
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

const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Answer> => {
  const result = await client.callTool({ name, arguments: args }) as {
    structuredContent?: Record<string, unknown>
    content?: Array<{ type: string; text?: string }>
    isError?: boolean
  }
  if (result.isError && typeof result.structuredContent?.kind === "string") {
    const text = result.content?.find(block => block.type === "text")?.text
    const reason = result.structuredContent.reason
    if (typeof reason !== "string") throw new Error("a structured refusal must carry its reason")
    expect(refusalIn(text ?? "")).toEqual({ kind: result.structuredContent.kind, reason })
  }
  return {
    structured: result.structuredContent ?? {},
    isError: result.isError === true,
  }
}

const withoutAge = (
  structured: Record<string, unknown>,
): Record<string, unknown> => {
  const { vintage, ...rest } = structured
  expect(vintage).toMatchObject({ stale: false, proof: "confirmed", ageMs: 0 })
  expect(typeof (vintage as Record<string, unknown>)["asOf"]).toBe("string")
  return rest
}

const findingsOf = (
  structured: Record<string, unknown>,
): ReadonlyArray<Record<string, unknown>> =>
  (structured["verdict"] as { readonly findings?: ReadonlyArray<Record<string, unknown>> })
    ?.findings as ReadonlyArray<Record<string, unknown>>

test("the tool list is reads and writes, and nothing that names a byte", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "capture_add",
      "files_create",
      "files_delete",
      "git_commit",
      "git_push",
      "markdown_create",
      "markdown_index",
      "markdown_read",
      "markdown_write",
      "outlines_add",
      "outlines_after",
      "outlines_apply",
      "outlines_cancelled",
      "outlines_date",
      "outlines_desc",
      "outlines_doing",
      "outlines_done",
      "outlines_duplicate",
      "outlines_index",
      "outlines_merge",
      "outlines_mirror",
      "outlines_move",
      "outlines_prop",
      "outlines_read",
      "outlines_repeat",
      "outlines_see",
      "outlines_split",
      "outlines_subtree",
      "outlines_title",
      "outlines_todo",
      "outlines_trash",
      "outlines_unmirror",
      "outlines_update",
      "search_nodes",
      "trash_empty",
      "trash_restore",
      "vault-plugins_guide",
      "vault-plugins_inspect",
      "vault-plugins_run",
      "vault-plugins_stop",
      "vault-plugins_write",
    ])

    expect(tools.find(tool => tool.name === "file-access_bodies_get")).toBeUndefined()

    const done = tools.find((tool) => tool.name === "outlines_done")
    expect(Object.keys(done?.inputSchema.properties ?? {}).sort()).toEqual(["id", "undo"])
    expect(JSON.stringify(done?.inputSchema)).not.toContain(`"op"`)

    const list = tools.find((tool) => tool.name === "outlines_index")
    expect(list?.inputSchema).toMatchObject({ type: "object", properties: {} })
    expect(JSON.stringify(list?.inputSchema)).not.toContain(`"value"`)
  })
})

test("the git verbs offer an agent what the panel offers a person", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    const commit = tools.find((tool) => tool.name === "git_commit")
    expect(Object.keys(commit?.inputSchema.properties ?? {}).sort())
      .toEqual(["message", "paths"])
    expect(commit?.description).toContain("pending")
    expect(commit?.description).toContain("index")

    const push = tools.find((tool) => tool.name === "git_push")
    expect(push?.inputSchema).toMatchObject({ type: "object", properties: {} })
    expect(push?.description).toContain("upstream")
  })
})

test("push answers rather than failing when nobody stands behind the ledger", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const answered = await call(client, "git_push", {})
    expect(answered.isError).toBe(false)
    expect(answered.structured).toMatchObject({
      _tag: "Failed",
      said: "nobody is recording writes here, so there is nobody to push",
    })
  })
})

test("each tool carries its title and its description", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const search = tools.find((tool) => tool.name === "search_nodes")
    expect(search?.title).toBe("Search the directory")
    expect(search?.description).toContain("Find nodes by title")
  })
})

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
        "`outlines_unmirror`",
        "`referencedBy`",
        "`blockedBy`",
      ]
    ) {
      expect(said("outlines_read")).toContain(field)
    }
    expect(said("search_nodes")).toContain("`after`")
    expect(said("search_nodes")).toContain("`custom`")
    expect(said("search_nodes")).toContain("`matchedProps`")
    expect(said("outlines_subtree")).toContain("on its row")
    expect(said("outlines_subtree")).toContain("`file`")
    expect(said("search_nodes")).toContain("`withDesc: true`")
    expect(said("outlines_read")).toContain("`parent`")
    expect(said("outlines_subtree")).toContain("`parent`")
    expect(said("search_nodes")).toContain("`parent`")
    expect(said("outlines_subtree")).toContain("`withDesc: false`")
    expect(said("outlines_read")).toContain("`fields`")
    expect(said("outlines_subtree")).toContain("`fields`")
    expect(said("outlines_read")).toContain("`custom.<key>`")
    expect(said("outlines_subtree")).toContain("`custom.<key>`")
  })
})

test("both annotation hints are pinned, for a read and for a write", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()
    const of = (name: string) => tools.find((tool) => tool.name === name)?.annotations

    expect(of("search_nodes")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("outlines_subtree")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("markdown_index")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("markdown_read")).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(of("outlines_done")).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    expect(of("outlines_trash")).toMatchObject({ readOnlyHint: false, destructiveHint: true })
  })
})

test("initialize tells a host what olai is, and nothing the tools disprove", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const said = client.getInstructions() ?? ""
    expect(said).toContain("NODES and whole FILES")
    expect(client.getServerVersion()).toMatchObject({ name: "olai" })

    expect(said).not.toContain("no file access")
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).filter((name) => name.startsWith("markdown_")).sort())
      .toEqual(["markdown_create", "markdown_index", "markdown_read", "markdown_write"])

    expect(said).toContain("`trash_empty` empties `_olai/Trash.olai`")
    expect(said).toContain("`files_delete`")
    expect(
      tools.map((tool) => tool.name).filter((name) =>
        name.includes("empty") || name.includes("delete")
      ),
    ).toEqual(["files_delete", "trash_empty"])

    expect(said).toContain("no path outside the served directory")
    expect(said).toContain("no way to name part of a file")

    expect(said).not.toContain("chat panel")
  })
})

test("a read answers over parsed nodes, with file:line and the marks", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const order = (await call(client, "outlines_read", { id: "order" })).structured
    expect(order).toMatchObject({
      id: "order",
      file: "house.olai",
      line: 3,
      path: ["Kitchen remodel"],
    })
    expect(order).not.toHaveProperty("status")

    const kitchen = (await call(client, "outlines_read", { id: "kitchen" })).structured
    expect(kitchen).not.toHaveProperty("status")
    expect(kitchen["progress"]).toEqual({ done: 1, total: 2 })
  })
})

test("search_nodes answers the reason when nobody stands behind the matcher", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const answered = await call(client, "search_nodes", { text: "cabinets" })
    expect(answered.isError).toBe(false)
    expect(answered.structured).toMatchObject({ hits: [], total: 0 })
    expect((answered.structured["refusals"] as ReadonlyArray<Record<string, unknown>>)[0])
      .toMatchObject({ token: "cabinets" })
  })
})

test("a subtree carries a node's see so an agent can traverse", async () => {
  const SEEING = [
    `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","see":["install"]}`,
    `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
    "",
  ].join("\n")

  await withTools({ "house.olai": SEEING }, async ({ client }) => {
    const tree = (await call(client, "outlines_subtree", { id: "kitchen", depth: 1 })).structured
    const children = tree["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children.find((child) => child["id"] === "order")).toMatchObject({
      see: ["install"],
    })
    expect(children.find((child) => child["id"] === "install")).not.toHaveProperty("see")
  })
})

test("a subtree carries a node's properties, so a board is one read", async () => {
  const PROPPED = [
    `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets",` +
    `"custom":{"pr":"https://github.com/juspay/olai/pull/179","agent":"claude-opus"}}`,
    `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
    "",
  ].join("\n")

  await withTools({ "house.olai": PROPPED }, async ({ client }) => {
    const tree = (await call(client, "outlines_subtree", { id: "kitchen", depth: 1 })).structured
    const children = tree["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children.find((child) => child["id"] === "order")).toMatchObject({
      custom: { agent: "claude-opus" },
    })
    expect(children.find((child) => child["id"] === "install")).not.toHaveProperty("custom")
  })
})

test("a `fields` walk answers the caller's exact rows, and only those", async () => {
  const PROPPED = [
    `{"id":"lane","ord":"a0","title":"the lane"}`,
    `{"id":"first","parent":"lane","ord":"a0","title":"ship the parser",` +
      `"started":"2026-08-29T09:08:00-04:00","done":"2026-08-29T09:12:00-04:00","custom":{"took":"4m","agent":"pi"}}`,
    `{"id":"second","parent":"lane","ord":"a1","title":"tidy the docs","doing":true}`,
    "",
  ].join("\n")

  await withTools({ "steps.olai": PROPPED }, async ({ client }) => {
    const tree = withoutAge((
      await call(client, "outlines_subtree", {
        id: "lane",
        depth: 1,
        fields: ["title", "status", "done", "custom.took", "took"],
      })
    ).structured)
    expect(tree).toEqual({
      id: "lane",
      title: "the lane",
      root: expect.any(String),
      children: [
        {
          id: "first",
          title: "ship the parser",
          status: "done",
          done: "2026-08-29T09:12:00-04:00",
          took: 240,
          custom: { took: "4m" },
          children: [],
        },
        { id: "second", title: "tidy the docs", status: "doing", children: [] },
      ],
    })

    const named = withoutAge(
      (await call(client, "outlines_read", { id: "lane", fields: ["status", "done"] })).structured,
    )
    const children = named["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children).toEqual([
      { id: "first", status: "done", done: "2026-08-29T09:12:00-04:00" },
      { id: "second", status: "doing" },
    ])
    expect(named).toMatchObject({ id: "lane", line: 1, file: "steps.olai", tags: [] })
  })
})

test("`fields` with an unknown name refuses, through the wire, saying `usage`", async () => {
  const PROPPED = `{"id":"lane","ord":"a0","title":"the lane"}\n`
  await withTools({ "steps.olai": PROPPED }, async ({ client }) => {
    const refused = await call(client, "outlines_subtree", { id: "lane", fields: ["props"] })
    expect(refused.isError).toBe(true)
    expect(refused.structured).toMatchObject({ kind: "usage" })
    expect(String(refused.structured["reason"])).toContain("`props` is not a field `fields` names")
    expect(String(refused.structured["reason"])).toContain("`custom.<key>`")

    const both = await call(client, "outlines_subtree", {
      id: "lane",
      fields: ["desc"],
      withDesc: false,
    })
    expect(both.isError).toBe(true)
    expect(String(both.structured["reason"])).toContain("`withDesc`")
  })
})

const PLAN = [
  `{"id":"today","ord":"a0","title":"Today"}`,
  `{"id":"call","parent":"today","ord":"a0","title":"call the joiner","todo":true,` +
  `"desc":"about the hinges, and the delivery slot"}`,
  `{"id":"later","ord":"a1","title":"Later"}`,
  `{"id":"echo","ord":"a2","mirror":"call"}`,
  "",
].join("\n")

test("outlines_subtree answers a whole outline — every root, one call", async () => {
  await withTools({ "plan.olai": PLAN, "house.olai": HOUSE }, async ({ client }) => {
    const answered = await call(client, "outlines_subtree", { file: "plan.olai" })
    expect(answered.isError).toBe(false)
    expect(answered.structured["file"]).toBe("plan.olai")

    const roots = answered.structured["roots"] as ReadonlyArray<Record<string, unknown>>
    expect(roots.map((root) => root["id"])).toEqual(["today", "later"])
    expect(
      ((answered.structured["placed"] ?? []) as ReadonlyArray<{ id: string }>).map((entry) => entry.id),
    ).toEqual(["echo"])
    const children = roots[0]?.["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children.map((child) => child["id"])).toEqual(["call"])
    expect(children[0]).toMatchObject({
      status: "todo",
      path: ["Today"],
      parent: "today",
    })

    const cut = (await call(client, "outlines_subtree", { file: "plan.olai", depth: 0 }))
      .structured["roots"] as ReadonlyArray<Record<string, unknown>>
    expect(cut[0]).toMatchObject({ id: "today", truncated: true })
    expect(cut[1]).not.toHaveProperty("truncated")
  })
})

test("outlines_subtree omits the notes when asked, and keeps them otherwise", async () => {
  await withTools({ "plan.olai": PLAN }, async ({ client }) => {
    const withNotes = (await call(client, "outlines_subtree", { id: "call" }))
      .structured
    expect(withNotes).toMatchObject({
      id: "call",
      desc: "about the hinges, and the delivery slot",
    })

    const lean = (await call(client, "outlines_subtree", {
      id: "call",
      withDesc: false,
    })).structured
    expect(lean).toMatchObject({ id: "call", parent: "today" })
    expect(lean).not.toHaveProperty("desc")
  })
})

test("outlines_subtree refuses a file that is not an outline, with the closest one", async () => {
  const files = {
    "plan.olai": PLAN,
    "house.olai": HOUSE,
    "finishes.md": "# Finishes\n",
  }
  await withTools(files, async ({ client }) => {
    const missed = await call(client, "outlines_subtree", { file: "plans.olai" })
    expect(missed.isError).toBe(true)
    expect(missed.structured).toMatchObject({ kind: "not-found", named: "plans.olai" })
    expect(missed.structured["reason"]).toContain("did you mean `plan.olai`")

    const refusedWrite = await call(client, "outlines_add", {
      file: "plans.olai",
      title: "anything",
    })
    expect(refusedWrite.structured["reason"]).toContain("did you mean `plan.olai`")

    const nowhere = await call(client, "outlines_subtree", { file: "nothing/like/this.olai" })
    expect(nowhere.structured["reason"]).toContain("plan.olai")
    expect(nowhere.structured["reason"]).toContain("house.olai")

    const document = await call(client, "outlines_subtree", { file: "finishes.md" })
    expect(document.isError).toBe(true)
    expect(document.structured).toMatchObject({ kind: "not-found" })
  })
})

test("outlines_subtree refuses an outline the set could not load", async () => {
  await withTools(
    { "plan.olai": PLAN, "torn.olai": "{ not a record" },
    async ({ client }) => {
      const listed = (await call(client, "outlines_index", {})).structured["outlines"] as
        ReadonlyArray<Record<string, unknown>>
      expect(listed.find((one) => one["file"] === "torn.olai")).toEqual({
        file: "torn.olai",
        unreadable: [expect.any(String)],
      })

      const refused = await call(client, "outlines_subtree", { file: "torn.olai" })
      expect(refused.isError).toBe(true)
      expect(refused.structured).toMatchObject({ kind: "validation" })
      expect(findingsOf(refused.structured)).toBeArrayOfSize(1)

      const reason = refused.structured["reason"] as string
      expect(reason).toContain("has lines that do not parse")
      expect(reason).not.toContain("could not be read")
      expect(reason).toContain("nothing to answer with")
    },
  )
})

test("outlines_subtree refuses a call naming both ways in, or neither", async () => {
  await withTools({ "plan.olai": PLAN }, async ({ client, root }) => {
    const both = await call(client, "outlines_subtree", { id: "today", file: "plan.olai" })
    expect(both.isError).toBe(true)
    expect(both.structured).toMatchObject({ kind: "usage" })
    expect(both.structured["reason"]).toContain("two different reads")

    const neither = await call(client, "outlines_subtree", {})
    expect(neither.isError).toBe(true)
    expect(neither.structured).toMatchObject({ kind: "usage" })
    expect(neither.structured["reason"]).toContain("whole outline")

    const gone = await call(client, "outlines_subtree", { id: "nope" })
    expect(gone.isError).toBe(false)
    expect(withoutAge(gone.structured)).toEqual({ missing: "nope", root })
  })
})

test("a node read and a subtree row both carry the parent's id", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const order = (await call(client, "outlines_read", { id: "order" })).structured
    expect(order).toMatchObject({ id: "order", parent: "kitchen" })
    const kitchen = (await call(client, "outlines_read", { id: "kitchen" })).structured
    expect(kitchen).not.toHaveProperty("parent")

    const tree = (await call(client, "outlines_subtree", { id: "kitchen", depth: 1 }))
      .structured
    const children = tree["children"] as ReadonlyArray<Record<string, unknown>>
    expect(children.find((child) => child["id"] === "order"))
      .toMatchObject({ parent: "kitchen" })
    expect(tree).not.toHaveProperty("parent")
  })
})

const VAULT = {
  "house.olai": HOUSE,
  "finishes.md": "# Finishes\n\nDoors: matte.\n",
  "notes/cabinets.md": "\n\n  Walnut, or birch.\n",
  "notes/plan.md":
    "---\nagent: claude-opus\nowners: [alice, bob]\n---\n# The plan\n",
  "empty.md": "",
  "saved/page.html": "<p>from the web</p>",
  "data/sales.csv": "region,units\nnorth,12\n",
  "art/handle.png": "not really a picture\n",
  "reports/q3.pdf": "%PDF-1.4\n",
}

test("markdown_index is the map of the other kind of file", async () => {
  await withTools(VAULT, async ({ client }) => {
    const answered = await call(client, "markdown_index", {})
    expect(answered.isError).toBe(false)
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

test("markdown_read answers the text a write would replace", async () => {
  await withTools(VAULT, async ({ client, root }) => {
    const answered = await call(client, "markdown_read", { file: "notes/cabinets.md" })
    expect(answered.isError).toBe(false)
    expect(withoutAge(answered.structured)).toEqual({
      file: "notes/cabinets.md",
      text: "\n\n  Walnut, or birch.\n",
      root,
    })
  })
})

test("read then write is one loop: what was read is what the guard takes", async () => {
  await withTools(VAULT, async ({ client, read }) => {
    const was = (await call(client, "markdown_read", { file: "finishes.md" }))
      .structured["text"] as string
    const wrote = await call(client, "markdown_write", {
      file: "finishes.md",
      text: `${was}Handles: brass.\n`,
      was,
    })
    expect(wrote.isError).toBe(false)
    expect(read("finishes.md")).toBe("# Finishes\n\nDoors: matte.\nHandles: brass.\n")

    expect((await call(client, "markdown_read", { file: "finishes.md" })).structured["text"])
      .toBe("# Finishes\n\nDoors: matte.\nHandles: brass.\n")
  })
})

test("files_delete removes a document, and the listing closes over it", async () => {
  await withTools(VAULT, async ({ client, read }) => {
    const made = await call(client, "markdown_create", {
      file: "notes/scratch.md",
      text: "scratch\n",
    })
    expect(made.isError).toBe(false)

    const gone = await call(client, "files_delete", { file: "notes/scratch.md" })
    expect(gone.isError).toBe(false)
    expect(gone.structured["sort"]).toBe("gone")
    expect(read("notes/scratch.md")).toBeNull()
    const answered = await call(client, "markdown_index", {})
    expect(
      (answered.structured["documents"] as ReadonlyArray<{ file: string }>)
        .map((document) => document.file),
    ).not.toContain("notes/scratch.md")
  })
})

test("a markdown_create racing a files_delete keeps its body — the incident's batch", async () => {
  const BRIEF = [
    "---",
    "lane: doorbell-missing-claim",
    "---",
    "",
    "# Brief: the doorbell misses a claim",
    "",
    ...Array.from(
      { length: 40 },
      (_, line) => `Detail paragraph ${line + 1}: the evidence, the trace, and the ruling.`,
    ),
    "",
  ].join("\n")
  await withTools(VAULT, async ({ client, read }) => {
    for (let round = 0; round < 8; round++) {
      const created = `briefs/dispatch-${round}.md`
      const deleting = round === 0 ? "empty.md" : `briefs/dispatch-${round - 1}.md`
      const [made, gone] = await Promise.all([
        call(client, "markdown_create", { file: created, text: BRIEF }),
        call(client, "files_delete", { file: deleting }),
      ])
      expect({ round, isError: made.isError }).toEqual({ round, isError: false })
      expect({ round, isError: gone.isError }).toEqual({ round, isError: false })
      expect({ round, held: read(created) }).toEqual({ round, held: BRIEF })
      expect(read(deleting)).toBeNull()
    }
  })
})

test("files_delete refuses an outline with records, naming them", async () => {
  await withTools(VAULT, async ({ client, read }) => {
    const refused = await call(client, "files_delete", { file: "house.olai" })
    expect(refused.isError).toBe(true)
    expect(refused.structured["kind"]).toBe("usage")
    expect(refused.structured["reason"]).toContain("`kitchen`")
    expect(refused.structured["reason"]).toContain("outlines_trash")
    expect(read("house.olai")).toBe(VAULT["house.olai"])
  })
})

test("files_delete refuses a kind the app only shows", async () => {
  await withTools(VAULT, async ({ client, read }) => {
    const refused = await call(client, "files_delete", { file: "saved/page.html" })
    expect(refused.isError).toBe(true)
    expect(refused.structured["reason"]).toContain("a page")
    expect(read("saved/page.html")).toBe("<p>from the web</p>")
  })
})

test("markdown_read refuses a path the set does not hold, with the closest one", async () => {
  await withTools(VAULT, async ({ client }) => {
    const missed = await call(client, "markdown_read", { file: "finishs.md" })
    expect(missed.isError).toBe(true)
    expect(missed.structured).toMatchObject({ kind: "not-found", named: "finishs.md" })
    expect(missed.structured["reason"]).toContain("did you mean `finishes.md`")

    const refusedWrite = await call(client, "markdown_write", {
      file: "finishs.md",
      text: "anything",
    })
    expect(refusedWrite.structured["reason"]).toContain("did you mean `finishes.md`")

    for (const file of ["saved/page.html", "data/sales.csv", "art/handle.png", "reports/q3.pdf"]) {
      const shown = await call(client, "markdown_read", { file })
      expect({ file, isError: shown.isError }).toEqual({ file, isError: true })
      expect({ file, kind: shown.structured["kind"] }).toEqual({ file, kind: "not-found" })
    }

    for (const file of ["../finishes.md", "/etc/passwd.md", "notes/../finishes.md", "./finishes.md"]) {
      const refused = await call(client, "markdown_read", { file })
      expect({ file, isError: refused.isError }).toEqual({ file, isError: true })
      expect({ file, kind: refused.structured["kind"] }).toEqual({ file, kind: "not-found" })
    }
  })
})

test("a document the set could not read is refused, not answered empty", async () => {
  await withTools(
    { ...VAULT, "torn.md": "whatever the bytes were" },
    async ({ client }) => {
      const listed = (await call(client, "markdown_index", {})).structured["documents"] as
        ReadonlyArray<Record<string, unknown>>
      expect(listed.find((one) => one["file"] === "torn.md")).toEqual({
        file: "torn.md",
        unreadable: [expect.any(String)],
      })

      const refused = await call(client, "markdown_read", { file: "torn.md" })
      expect(refused.isError).toBe(true)
      expect(refused.structured).toMatchObject({ kind: "validation" })
      expect(findingsOf(refused.structured)).toBeArrayOfSize(1)

      const write = await call(client, "markdown_write", { file: "torn.md", text: "x" })
      expect(write.isError).toBe(true)
      expect(write.structured).toMatchObject({ kind: "validation" })
    },
    new Set(["torn.md"]),
  )
})

test("outlines_move carries a subtree into another outline, and nothing pointing at it moves", async () => {
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

      const answer = await call(client, "outlines_move", { id: "install", parent: "garden" })
      expect(answer.isError).toBe(false)
      expect(answer.structured).toMatchObject({
        did: "outlines_move",
        id: "install",
        file: "garden.olai",
      })

      expect(read("house.olai")).not.toContain(`"id":"install"`)
      expect(read("garden.olai")).toContain(
        `{"id":"install","parent":"garden","ord":"a2","title":"install them","doing":"2026-08-02"`,
      )

      const named = pointing.split("\n").filter((one) => one.includes("install"))
      expect(named).toHaveLength(2)
      for (const line of named) expect(read("garden.olai")).toContain(line)
    },
  )
})

test("outlines_move with a `file` lands the subtree at that outline's top level", async () => {
  await withTools(
    { "house.olai": HOUSE, "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}\n` },
    async ({ client, read }) => {
      const answer = await call(client, "outlines_move", { id: "kitchen", file: "garden.olai" })
      expect(answer.isError).toBe(false)
      expect(read("house.olai")).toBe("")
      const arrived = read("garden.olai") ?? ""
      expect(arrived.split("\n").filter((one) => one !== "").map((one) => JSON.parse(one).id))
        .toEqual(["garden", "kitchen", "demo", "order", "install"])
      expect(arrived).toContain(`{"id":"demo","parent":"kitchen"`)
    },
  )
})

test("outlines_move is refused when it would take a `ref` variant out of its root", async () => {
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

      const out = await call(client, "outlines_move", { id: "claude", parent: "elsewhere" })
      expect(out.isError).toBe(true)
      expect(out.structured).toMatchObject({
        kind: "validation",
        reason: "`move: Claude` would leave `lanes.olai` invalid, so nothing was written",
      })
      const rows = findingsOf(out.structured)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ file: "lanes.olai", line: 1, code: "bad-prop" })
      expect(String(rows[0]?.["message"])).toContain("`agent`")
      expect(String(rows[0]?.["message"])).toContain("`roster`")
      expect(read("agents.olai")).toBe(agents)
      expect(read("lanes.olai")).toBe(lanes)

      const root = await call(client, "outlines_move", { id: "roster", parent: "elsewhere" })
      expect(root.isError).toBe(false)
      expect(read("agents.olai")).toBe("")
      expect(read("lanes.olai")).toContain(`{"id":"claude","parent":"roster"`)
      expect(read("lanes.olai")).toContain(`"custom":{"agent":"claude"}`)
    },
  )
})

test("outlines_add of a bad type in Properties.olai names the legal vocabulary", async () => {
  await withTools(
    {
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n`,
    },
    async ({ client }) => {
      const unknown = await call(client, "outlines_add", {
        file: "_olai/Properties.olai",
        title: "took",
        props: { type: "took" },
      })
      expect(unknown.isError).toBe(true)
      expect(unknown.structured).toMatchObject({ kind: "usage" })
      expect(String(unknown.structured["reason"])).toContain(
        "`type` is `took`, which is not a property type",
      )
      expect(String(unknown.structured["reason"])).toContain("`int` (a digit run)")
      expect(String(unknown.structured["reason"])).toContain(
        "`ref` (a child's id; `under` names the parent)",
      )
      expect(String(unknown.structured["reason"])).not.toContain("would leave")

      const missing = await call(client, "outlines_add", {
        file: "_olai/Properties.olai",
        title: "musts",
      })
      expect(missing.isError).toBe(true)
      expect(missing.structured).toMatchObject({ kind: "usage" })
      expect(String(missing.structured["reason"])).toContain("does not say its `type`")
      expect(String(missing.structured["reason"])).toContain("`text` (anything)")
      expect(String(missing.structured["reason"])).toContain(
        "`ref` (a child's id; `under` names the parent)",
      )
    },
  )
})

test("declaring a type over unfit values is refused; one apply repairs; then it accepts", async () => {
  await withTools(
    {
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}\n`,
      "lanes.olai": [
        `{"id":"a","ord":"a0","title":"first","custom":{"brainstorm":"not a path"}}`,
        `{"id":"b","ord":"a1","title":"second","custom":{"brainstorm":"also prose"}}`,
        `{"id":"c","ord":"a2","title":"third","custom":{"brainstorm":"still not"}}`,
        "",
      ].join("\n"),
      "briefs/one.md": "one\n",
      "briefs/two.md": "two\n",
      "briefs/three.md": "three\n",
    },
    async ({ client, read }) => {
      const refused = await call(client, "outlines_add", {
        file: "_olai/Properties.olai",
        title: "brainstorm",
        props: { type: "doc" },
      })
      expect(refused.isError).toBe(true)
      expect(refused.structured).toMatchObject({ kind: "usage" })
      const reason = String(refused.structured["reason"])
      expect(reason).toContain("`brainstorm` cannot be declared `doc`")
      expect(reason).toContain("`lanes.olai` `first` (`a`) holds \"not a path\"")
      expect(reason).toContain("`lanes.olai` `second` (`b`) holds \"also prose\"")
      expect(reason).toContain("`lanes.olai` `third` (`c`) holds \"still not\"")
      expect(read("_olai/Properties.olai")).not.toContain("brainstorm")

      const cleaned = await call(client, "outlines_apply", {
        ops: [
          { op: "prop", id: "a", key: "brainstorm", value: "briefs/one.md" },
          { op: "prop", id: "b", key: "brainstorm", value: "briefs/two.md" },
          { op: "prop", id: "c", key: "brainstorm", value: "briefs/three.md" },
        ],
      })
      expect(cleaned.isError).toBe(false)

      const declared = await call(client, "outlines_add", {
        file: "_olai/Properties.olai",
        title: "brainstorm",
        props: { type: "doc" },
      })
      expect(declared.isError).toBe(false)
      expect(read("_olai/Properties.olai")).toContain(`"title":"brainstorm"`)
      expect(read("_olai/Properties.olai")).toContain(`"type":"doc"`)
    },
  )
})

test("outlines_move refuses a trash at either end, toward the verb that does that job", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    await call(client, "outlines_trash", { id: "demo" })
    const into = await call(client, "outlines_move", { id: "order", file: "_olai/Trash.olai" })
    expect(into.isError).toBe(true)
    expect(String(into.structured["reason"])).toContain("`outlines_trash`")

    const out = await call(client, "outlines_move", { id: "demo", parent: "order" })
    expect(out.isError).toBe(true)
    expect(String(out.structured["reason"])).toContain("`trash_restore`")
  })
})

test("a write through a tool changes the directory", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const answer = await call(client, "outlines_done", { id: "order" })
    expect(answer.isError).toBe(false)
    expect(answer.structured).toMatchObject({ did: "outlines_done", id: "order" })
    expect(read("house.olai")).toContain(`"done":${JSON.stringify(STAMP)}`)
  })
})

test("outlines_prop with a stale `was` is refused, naming what is there", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const { tools } = await client.listTools()
    const setProp = tools.find((tool) => tool.name === "outlines_prop")
    expect(setProp?.description).toContain("`was`")
    expect(Object.keys(setProp?.inputSchema.properties ?? {}).sort())
      .toEqual(["id", "key", "value", "was"])

    const added = await call(client, "outlines_prop", { id: "order", key: "stage", value: "review", was: null })
    expect(added.isError).toBe(false)
    expect(read("house.olai")).toContain(`"custom":{"stage":"review"}`)

    const moved = await call(client, "outlines_prop", { id: "order", key: "stage", value: "submitted", was: "review" })
    expect(moved.isError).toBe(false)

    const stale = await call(client, "outlines_prop", { id: "order", key: "stage", value: "audit", was: "review" })
    expect(stale.isError).toBe(true)
    expect(String(stale.structured["reason"])).toContain(
      "expected to replace (`review`) — it now says `submitted`, so nothing was written",
    )
    expect(read("house.olai")).toContain(`"custom":{"stage":"submitted"}`)

    const plain = await call(client, "outlines_prop", { id: "order", key: "stage", value: "audit" })
    expect(plain.isError).toBe(false)
    expect(read("house.olai")).toContain(`"custom":{"stage":"audit"}`)
  })
})

test("outlines_repeat, outlines_read and outlines_done are one recurrence through the tools", async () => {
  await withTools({ "chores.olai": CHORES }, async ({ client, read }) => {
    const set = await call(client, "outlines_repeat", {
      id: "bins",
      repeat: "every week on monday",
    })
    expect(set.isError).toBe(false)
    expect(read("chores.olai")).toContain(`"repeat":"every week on monday"`)

    expect((await call(client, "outlines_read", { id: "bins" })).structured)
      .toMatchObject({ id: "bins", date: "2026-08-17", repeat: "every week on monday" })

    const done = await call(client, "outlines_done", { id: "bins" })
    expect(done.isError).toBe(false)
    const made = done.structured["captured"] as ReadonlyArray<Record<string, unknown>>
    expect(made).toHaveLength(1)
    expect(made[0]).toMatchObject({ title: "put the bins out" })
    expect(String(done.structured["nudge"])).toContain("2026-08-24")

    expect(read("chores.olai"))
      .toContain(`"todo":true,"date":"2026-08-24","repeat":"every week on monday"`)
    expect((await call(client, "outlines_read", { id: "bins" })).structured)
      .not.toHaveProperty("repeat")
  })
})

test("a repeat with no date to repeat from is refused, and nothing is written", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "outlines_repeat", { id: "order", repeat: "every day" })
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
    const answer = await call(client, "outlines_repeat", { id: "bins", repeat: "every 2 weeks" })
    expect(answer.isError).toBe(true)
    expect(findingsOf(answer.structured)).toMatchObject([
      { file: "chores.olai", line: 1, code: "bad-repeat" },
    ])
    expect(JSON.stringify(answer.structured)).toContain("every week on <weekday>")
    expect(read("chores.olai")).toBe(CHORES)
  })
})

test("a date that is not a date is refused too, by the same gate", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const answer = await call(client, "outlines_date", { id: "order", date: "someday" })
    expect(answer.isError).toBe(true)
    expect(findingsOf(answer.structured)).toMatchObject([
      { file: "house.olai", code: "bad-date" },
    ])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

test("files_create mints a file through the same tool surface as every other write", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, set }) => {
    const answer = await call(client, "files_create", {
      file: "inbox.olai",
      seed: { title: "something to capture" },
    })
    expect(answer.structured).toMatchObject({
      did: "files_create",
      file: "inbox.olai",
      title: "something to capture",
      summary: "capture: something to capture",
    })
    expect(read("inbox.olai")).toContain("something to capture")
    expect(outlinePaths(await set())).toContain("inbox.olai")
  })
})

test("marking a parent over unfinished work is refused, with the tasks as data", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "outlines_done", { id: "kitchen" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("usage")
    expect(String(answer.structured["reason"])).toContain("`install them` (`install`, doing)")
    expect(String(answer.structured["reason"])).not.toContain("order the cabinets")
    expect(refusals).toEqual(["done: UsageFailure"])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

test("filing work under a finished branch re-opens it, and the answer says so", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const shut = await call(client, "outlines_done", { id: "order" })
    expect(shut.isError).toBe(false)

    const filed = await call(client, "outlines_add", {
      parent: "order",
      title: "chase the delivery date",
      mark: "todo",
    })
    expect(filed.isError).toBe(false)
    expect(String(filed.structured["nudge"])).toContain("`order the cabinets` was marked done")
    expect(String(filed.structured["summary"])).toContain("(reopened: order the cabinets)")
    expect(refusals).toEqual([])
    expect(read("house.olai")).not.toContain(`"done":${JSON.stringify(STAMP)}`)
    expect(read("house.olai")).toContain("chase the delivery date")
  })
})

test("a refused write is an isError result carrying its kind", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "outlines_done", { id: "nowhere" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("not-found")
    expect(answer.structured["named"]).toBe("nowhere")
    expect(refusals).toEqual(["done: NotFoundFailure"])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

test("arguments that do not fit the tool are refused before any planning", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "outlines_done", { nope: 1 })
    expect(answer.isError).toBe(true)
    expect(refusals).toEqual([])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

type Provocation = {
  readonly files: Readonly<Record<string, string>>
  readonly tool: string
  readonly args: Record<string, unknown>
}
type Unreachable = { readonly unreachable: string }

const PINNED: Record<FailureKind, Provocation | Unreachable> = {
  "not-found": {
    files: { "house.olai": HOUSE },
    tool: "outlines_done",
    args: { id: "nowhere" },
  },
  usage: {
    files: { "house.olai": HOUSE },
    tool: "outlines_after",
    args: { id: "order", add: ["order"] },
  },
  validation: {
    files: { "house.olai": HOUSE, "orphan.olai": ORPHAN },
    tool: "outlines_subtree",
    args: { file: "orphan.olai" },
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

test("a broken outline refuses with its own rows while its neighbours answer", async () => {
  await withTools({ "house.olai": HOUSE, "orphan.olai": ORPHAN }, async ({ client, read }) => {
    const found = await call(client, "search_nodes", { text: "kitchen" })
    expect(found.isError).toBeFalsy()

    const wrote = await call(client, "outlines_done", { id: "order" })
    expect(wrote.isError).toBeFalsy()
    expect(read("house.olai")).toContain(`"done"`)

    const refused = await call(client, "outlines_subtree", { file: "orphan.olai" })
    expect(refused.isError).toBe(true)
    expect(refused.structured["kind"]).toBe("validation")
    const rows = findingsOf(refused.structured)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toMatchObject({ file: "orphan.olai", code: "unknown-parent" })
    for (const row of rows) {
      expect(typeof row["code"]).toBe("string")
      expect(typeof row["message"]).toBe("string")
      expect(typeof row["line"]).toBe("number")
    }

    const cell = await client.readResource({ uri: "surface://cells/file-access/errors" })
    const said = cell.contents[0]
    if (said === undefined || !("text" in said)) {
      throw new Error("surface://cells/file-access/errors: expected one text part")
    }
    expect(JSON.parse(said.text as string)).toEqual({ findings: [] })

    const entry = await client.readResource({
      uri: "surface://collections/outlines/outlines/orphan.olai",
    })
    const part = entry.contents[0]
    if (part === undefined || !("text" in part)) {
      throw new Error("surface://collections/outlines/outlines/orphan.olai: expected one text part")
    }
    const published = JSON.parse(part.text as string) as Record<string, unknown>
    expect((published["broken"] as { errors: ReadonlyArray<unknown> }).errors).toEqual(rows)
    expect(published["nodes"]).toEqual([])
  })
})

test("a tool that does not exist is an error result, not a protocol error", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const answer = await call(client, "read_file", {})
    expect(answer.isError).toBe(true)
  })
})

test("one outlines_add lands a whole subtree, and says what it made", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, set }) => {
    const answer = await call(client, "outlines_add", {
      parent: "kitchen",
      title: "the pantry",
      children: [
        { title: "shelves", children: [{ title: "measure", mark: "todo" }] },
        { title: "paint", desc: "the same white", mark: "done" },
      ],
    })

    expect(answer.isError).toBe(false)
    expect(answer.structured).toMatchObject({
      did: "outlines_add",
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

    const nodes = new Map(
      recordsOf(await set()).map((located) => [located.node.id, located.node]),
    )
    const [pantry, shelves, measure] = captured
    expect(nodes.get(shelves?.id ?? "")).toMatchObject({ parent: pantry?.id })
    expect(nodes.get(measure?.id ?? "")).toMatchObject({ parent: shelves?.id })
  })
})

test("both capture tools advertise children as a finite nested schema, no $ref", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    const nested = (schema: unknown): Record<string, unknown> | undefined =>
      ((schema as { properties?: Record<string, { items?: unknown }> })
        ?.properties?.["children"]?.items) as Record<string, unknown> | undefined

    const walk = (root: unknown): void => {
      let at = root
      for (let level = 0; level < 3; level++) {
        at = nested(at)
        expect(Object.keys((at as { properties: object })?.properties ?? {}).sort())
          .toEqual([
            "after",
            "children",
            "date",
            "desc",
            "id",
            "mark",
            "props",
            "see",
            "title",
            "waitsOn",
          ])
      }
      const floor = (at as { properties: Record<string, Record<string, unknown>> })
        .properties["children"] as Record<string, unknown>
      expect(floor["type"]).toBe("array")
      expect(floor["items"]).toBeUndefined()
      expect(String(floor["description"])).toContain("second `outlines_add`")
    }

    const add = tools.find((tool) => tool.name === "outlines_add")
    expect(JSON.stringify(add?.inputSchema)).not.toContain("$ref")
    walk(add?.inputSchema)

    const create = tools.find((tool) => tool.name === "files_create")
    expect(JSON.stringify(create?.inputSchema)).not.toContain("$ref")
    walk(
      (create?.inputSchema as { properties: Record<string, unknown> })
        .properties["seed"],
    )
  })
})

test("outlines_index then outlines_add — the capture sequence an agent actually runs", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const listed = (await call(client, "outlines_index", {})).structured

    const outlines = listed["outlines"] as ReadonlyArray<{ file: string }>
    expect(outlines[0]?.file).toBe("house.olai")

    const added = await call(client, "outlines_add", {
      file: outlines[0]?.file,
      title: "water the plants",
    })
    expect(added.isError).toBe(false)
    expect(read("house.olai")).toContain("water the plants")
  })
})

const LEDGER = [
  `{"id":"now","ord":"a0","title":"Now"}`,
  "",
].join("\n")

test("a mirror is placed, found from the node, and retired — the node untouched", async () => {
  await withTools(
    { "house.olai": HOUSE, "now.olai": LEDGER },
    async ({ client, read }) => {
      const placed = await call(client, "outlines_mirror", {
        target: "order",
        parent: "now",
        id: "now-order",
      })
      expect(placed.isError).toBe(false)
      expect(placed.structured).toMatchObject({
        did: "outlines_mirror",
        id: "now-order",
        title: "order the cabinets",
        file: "now.olai",
        summary: "mirror: order the cabinets",
      })
      expect(read("now.olai")).toContain(
        `{"id":"now-order","parent":"now","ord":"a0","mirror":"order"}`,
      )
      expect(read("house.olai")).toBe(HOUSE)

      const node = (await call(client, "outlines_read", { id: "order" })).structured
      expect(node["mirrors"]).toEqual([
        { id: "now-order", file: "now.olai", line: 2, parent: "now" },
      ])

      const retired = await call(client, "outlines_unmirror", { id: "now-order" })
      expect(retired.isError).toBe(false)
      expect(retired.structured).toMatchObject({
        did: "outlines_unmirror",
        summary: "unmirror: order the cabinets",
      })
      expect(read("now.olai")).toBe(LEDGER)
      expect(read("house.olai")).toBe(HOUSE)
      expect((await call(client, "outlines_read", { id: "order" })).structured)
        .not.toHaveProperty("mirrors")
    },
  )
})

test("outlines_read answers what a curated list holds, with what each entry shows", async () => {
  await withTools(
    { "house.olai": HOUSE, "now.olai": LEDGER },
    async ({ client }) => {
      await call(client, "outlines_mirror", { target: "order", parent: "now", id: "now-order" })
      await call(client, "outlines_mirror", { target: "install", parent: "now", id: "now-install" })

      const now = (await call(client, "outlines_read", { id: "now" })).structured
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
            parent: "kitchen",
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
            parent: "kitchen",
            status: "doing",
            path: ["Kitchen remodel"],
          },
        },
      ])
    },
  )
})

test("outlines_unmirror on a node refuses, and says what does put a node away", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const answer = await call(client, "outlines_unmirror", { id: "order" })
    expect(answer.isError).toBe(true)
    expect(answer.structured["kind"]).toBe("usage")
    expect(String(answer.structured["reason"])).toContain("outlines_trash")
    expect(refusals).toEqual(["unmirror: UsageFailure"])
    expect(read("house.olai")).toBe(HOUSE)
  })
})

test("trash_restore takes back what outlines_trash put away", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const away = await call(client, "outlines_trash", { id: "order" })
    expect(away.isError).toBe(false)
    expect(read("house.olai")).not.toContain(`"id":"order"`)
    expect(read("_olai/Trash.olai")).toContain(`"id":"order"`)

    const back = await call(client, "trash_restore", { id: "order" })
    expect(back.isError).toBe(false)
    expect(back.structured).toMatchObject({
      summary: "untrash: order the cabinets",
      file: "house.olai",
    })
    expect(read("house.olai")).toContain(`"id":"order","parent":"kitchen"`)
    expect(read("_olai/Trash.olai")).toBe("")
  })
})

test("a done mark minted in the archive is re-opened when the subtree comes back", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const away = await call(client, "outlines_trash", { id: "install" })
    expect(away.isError).toBe(false)
    const shut = await call(client, "outlines_done", { id: "install" })
    expect(shut.isError).toBe(false)
    expect(read("_olai/Trash.olai")).toContain(`"id":"install"`)

    const filed = await call(client, "outlines_add", {
      parent: "install",
      title: "chase the fitter",
      mark: "todo",
    })
    expect(filed.isError).toBe(false)
    expect(String(filed.structured["nudge"] ?? "")).not.toContain("marked done")

    const back = await call(client, "trash_restore", { id: "install" })
    expect(back.isError).toBe(false)
    expect(String(back.structured["nudge"]))
      .toContain("`install them` was marked done over work that is not finished")
    expect(String(back.structured["summary"])).toContain("(reopened: install them)")
    expect(read("house.olai")).toContain("chase the fitter")
    expect(read("house.olai")).not.toContain(`"id":"install","parent":"kitchen","ord":"a2","done"`)
  })
})

test("trash_empty deletes the pile, and refuses while something still points into it", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const linked = await call(client, "outlines_see", { id: "demo", add: ["order"] })
    expect(linked.isError).toBe(false)
    const away = await call(client, "outlines_trash", { id: "order" })
    expect(away.isError).toBe(false)
    const filled = read("_olai/Trash.olai")
    expect(filled).toContain(`"id":"order"`)

    const held = await call(client, "trash_empty", { file: "_olai/Trash.olai" })
    expect(held.isError).toBe(true)
    expect(held.structured["kind"]).toBe("usage")
    expect(String(held.structured["reason"])).toContain("`demo`")
    expect(String(held.structured["reason"])).toContain("`see`")
    expect(read("_olai/Trash.olai")).toBe(filled)
    expect(refusals).toEqual(["empty: UsageFailure"])

    const freed = await call(client, "outlines_see", { id: "demo", remove: ["order"] })
    expect(freed.isError).toBe(false)
    const gone = await call(client, "trash_empty", { file: "_olai/Trash.olai" })
    expect(gone.isError).toBe(false)
    expect(gone.structured).toMatchObject({
      summary: "empty: _olai/Trash.olai (3 records)",
      file: "_olai/Trash.olai",
      did: "trash_empty",
    })
    expect(read("_olai/Trash.olai")).toBe("")
    expect(read("house.olai")).toContain(`"id":"kitchen"`)
  })
})

test("trash_empty refuses a live outline, and an archive with nothing in it", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const live = await call(client, "trash_empty", { file: "house.olai" })
    expect(live.isError).toBe(true)
    expect(String(live.structured["reason"])).toContain("is not the trash")
    expect(read("house.olai")).toBe(HOUSE)

    await call(client, "outlines_trash", { id: "order" })
    await call(client, "trash_restore", { id: "order" })
    expect(read("_olai/Trash.olai")).toBe("")
    const twice = await call(client, "trash_empty", { file: "_olai/Trash.olai" })
    expect(twice.isError).toBe(true)
    expect(String(twice.structured["reason"])).toContain("already empty")
  })
})

test("trash_empty over two piles judges the edge between them as a record that goes", async () => {
  await withTools({
    "house.olai": HOUSE,
    "garden/plot.olai": [
      `{"id":"beds","ord":"a0","title":"the beds"}`,
      `{"id":"quote","parent":"beds","ord":"a0","title":"a quote","see":["order"]}`,
      "",
    ].join("\n"),
  }, async ({ client, read }) => {
    expect((await call(client, "outlines_trash", { id: "order" })).isError).toBe(false)
    expect((await call(client, "outlines_trash", { id: "beds" })).isError).toBe(false)
    expect(read("_olai/Trash.olai")).toContain(`"id":"order"`)
    expect(read("_olai/Trash.olai")).toContain(`"id":"quote"`)

    const gone = await call(client, "trash_empty", {
      file: "_olai/Trash.olai",
    })
    expect(gone.isError).toBe(false)
    expect(String(gone.structured["summary"]))
      .toBe("empty: _olai/Trash.olai (6 records)")
    expect(read("_olai/Trash.olai")).toBe("")
  })
})

test("trash_empty still refuses for a namer in a leftover Archive.olai", async () => {
  await withTools({
    "house.olai": HOUSE,
    "Archive.olai": `{"id":"quote","ord":"a0","title":"a leftover quote","see":["order"]}`,
  }, async ({ client, read }) => {
    await call(client, "outlines_trash", { id: "order" })
    const held = await call(client, "trash_empty", { file: "_olai/Trash.olai" })
    expect(held.isError).toBe(true)
    expect(String(held.structured["reason"])).toContain("`quote`")
    expect(read("_olai/Trash.olai")).toContain(`"id":"order"`)
    expect(read("Archive.olai")).toContain(`"id":"quote"`)
  })
})

test("trash_empty with a stale `was` deletes nothing and names both counts", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    await call(client, "outlines_trash", { id: "order" })
    const filled = read("_olai/Trash.olai")

    const stale = await call(client, "trash_empty", { file: "_olai/Trash.olai", was: 1 })
    expect(stale.isError).toBe(true)
    expect(String(stale.structured["reason"])).toContain("held 1 record when this was asked for")
    expect(read("_olai/Trash.olai")).toBe(filled)

    const right = await call(client, "trash_empty", { file: "_olai/Trash.olai", was: 3 })
    expect(right.isError).toBe(false)
    expect(read("_olai/Trash.olai")).toBe("")
  })
})

test("outlines_after writes a dependency, and a loop is refused naming it", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const wired = await call(client, "outlines_after", { id: "install", add: ["order"] })
    expect(wired.isError).toBe(false)
    expect(wired.structured).toMatchObject({ summary: "after: install them" })
    expect(read("house.olai")).toContain(`"after":["order"]`)

    expect((await call(client, "outlines_read", { id: "install" })).structured)
      .toMatchObject({ after: ["order"] })

    const loop = await call(client, "outlines_after", { id: "order", add: ["install"] })
    expect(loop.isError).toBe(true)
    expect(loop.structured["kind"]).toBe("usage")
    expect(String(loop.structured["reason"])).toContain("`order` → `install` → `order`")
  })
})

test("outlines_read says what a node is waiting on, and drops the field when it clears", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    await call(client, "outlines_after", { id: "install", add: ["order"] })
    await call(client, "outlines_todo", { id: "order" })

    expect((await call(client, "outlines_read", { id: "install" })).structured["blockedBy"])
      .toEqual([{
        id: "order",
        title: "order the cabinets",
        file: "house.olai",
        line: 3,
        parent: "kitchen",
        path: ["Kitchen remodel"],
        status: "todo",
      }])

    await call(client, "outlines_done", { id: "order" })
    expect((await call(client, "outlines_read", { id: "install" })).structured)
      .not.toHaveProperty("blockedBy")
  })
})

test("`outlines_apply` runs a list of ops as one write, and names the op that refused", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read, refusals }) => {
    const done = await call(client, "outlines_apply", {
      ops: [
        { op: "done", id: "order" },
        { op: "prop", id: "install", key: "pr", value: "https://x/1" },
        { op: "add", parent: "kitchen", id: "worktop", title: "fit the worktop" },
        { op: "after", id: "worktop", add: ["install"] },
      ],
    })
    expect(done.isError).toBe(false)
    expect(done.structured["did"]).toBe("outlines_apply")
    expect(String(done.structured["summary"])).toContain("apply: 4 ops")
    expect(done.structured["rev"]).toBe(2)
    expect(done.structured["captured"]).toEqual([{ id: "worktop", title: "fit the worktop" }])

    const text = read("house.olai") ?? ""
    expect(text).toContain(`"done":${JSON.stringify(STAMP)}`)
    expect(text).toContain(`"custom":{"pr":"https://x/1"}`)
    expect(text).toContain(`"after":["install"]`)

    const before = read("house.olai")
    const stopped = await call(client, "outlines_apply", {
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
    const written = await call(client, "outlines_update", {
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

    const merged = await call(client, "outlines_update", { id: "order", props: { pr: null } })
    expect(merged.isError).toBe(false)
    expect(read("house.olai")).toContain(`"custom":{"agent":"claude-opus"}`)

    const blocked = await call(client, "outlines_update", {
      id: "kitchen",
      mark: "doing",
      after: ["install"],
    })
    expect(blocked.isError).toBe(true)
    expect(blocked.structured["kind"] as FailureKind).toBe("usage")
    expect(String(blocked.structured["reason"])).toContain("it cannot start yet")
    expect(read("house.olai")).not.toContain(`"after":["install"]`)
  })
})

test("a capture arrives with its edges and its properties, pointing forward", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const captured = await call(client, "outlines_add", {
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

    const loop = await call(client, "outlines_add", {
      parent: "kitchen",
      title: "ring",
      children: [
        { id: "x", title: "x", waitsOn: ["y"] },
        { id: "y", title: "y", waitsOn: ["x"] },
      ],
    })
    expect(loop.isError).toBe(true)
    expect(String(loop.structured["reason"])).toContain("closes a loop")

    const shadowed = await call(client, "outlines_add", {
      parent: "kitchen",
      title: "shadow",
      props: { done: "yesterday" },
    })
    expect(shadowed.isError).toBe(true)
    expect(String(shadowed.structured["reason"]))
      .toContain("a node already says `done` with a field of its own")
  })
})

test("`outlines_apply` and `outlines_update` advertise finite schemas with no $ref", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const { tools } = await client.listTools()

    const apply = tools.find((tool) => tool.name === "outlines_apply")
    expect(JSON.stringify(apply?.inputSchema)).not.toContain("$ref")
    expect(JSON.stringify(apply?.inputSchema)).not.toContain("$defs")
    expect(Object.keys(apply?.inputSchema.properties ?? {})).toEqual(["ops"])

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
    for (const op of ["create", "create-doc", "doc", "delete", "apply"]) {
      expect(verbs).not.toContain(op)
    }

    const update = tools.find((tool) => tool.name === "outlines_update")
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

test("a `was` and a bent `after` reach the planner instead of vanishing", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, read }) => {
    const held = await call(client, "outlines_update", {
      id: "order",
      title: "order the walnut cabinets",
      was: { title: "order the cabinets" },
    })
    expect(held.isError).toBe(false)
    expect(read("house.olai")).toContain("order the walnut cabinets")

    const stale = await call(client, "outlines_update", {
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

    const idle = await call(client, "outlines_update", {
      id: "order",
      desc: "x",
      was: { title: "anything" },
    })
    expect(idle.isError).toBe(true)
    expect(String(idle.structured["reason"])).toContain("`was.title`")

    const bent = await call(client, "outlines_add", {
      parent: "kitchen",
      title: "lane",
      children: [{ title: "cut", after: ["order"] }],
    })
    expect(bent.isError).toBe(true)
    expect(String(bent.structured["reason"])).toContain("write `waitsOn` instead")
    expect(read("house.olai")).not.toContain(`"title":"lane"`)
  })
})

const captured = (set: OutlineSet, title: string) => {
  const found = recordsOf(set)
    .map((one) => one.node)
    .find((one) => !("mirror" in one) && one.title === title)
  if (found === undefined || "mirror" in found) throw new Error(`no capture titled ${title}`)
  return found
}

test("a capture lands in a minted inbox, dated and attributed", async () => {
  await withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    const answered = await call(client, "capture_add", {
      title: "the thread about cabinets",
      text: "worth a reply",
    })
    expect(answered.isError).toBe(false)
    expect(answered.structured["file"]).toBe("_olai/Inbox.olai")
    expect(answered.structured["did"]).toBe("capture_add")

    const node = captured(await set(), "the thread about cabinets")
    expect(node.desc ?? "").toBe("worth a reply")
    expect(typeof node.date).toBe("string")
    expect(node.todo).toBe(true)
    const landed = readingOf(await set())
    expect(inboxHeldOf(landed.set, landed.derived)).toEqual({ count: 1 })
  })
})

test("…and into the inbox the directory already keeps, by stem under _olai", async () => {
  await withTools(
    { "a.olai": HOUSE, "_olai/inbox.olai": "" },
    async ({ client, set }) => {
      const answered = await call(client, "capture_add", { title: "buy milk" })
      expect(answered.isError).toBe(false)
      expect(answered.structured["file"]).toBe("_olai/inbox.olai")
      expect([...outlinePaths(await set())].sort()).toEqual(["_olai/inbox.olai", "a.olai"])
    },
  )
})

test("a door that knows nobody writes no attribution, rather than a false one", () => {
  return withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    await call(client, "capture_add", { title: "unattributed" })
    const node = captured(await set(), "unattributed")
    expect("custom" in node ? node.custom : undefined).toBeUndefined()
  })
})

test("…and a door that DOES know somebody writes it on", async () => {
  await withTools(
    { "a.olai": HOUSE },
    async ({ client, set }) => {
      await call(client, "capture_add", { title: "attributed" })
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
    const answered = await call(client, "capture_add", {
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
    const answered = await call(client, "capture_add", { title: "" })
    expect(answered.isError).toBe(true)
    expect(outlinePaths(await set())).toEqual(["a.olai"])
  })
})

test("several captures at once into a directory with no inbox all land", async () => {
  await withTools({ "a.olai": HOUSE }, async ({ client, set }) => {
    const many = [1, 2, 3, 4, 5, 6]
    const answered = await Promise.all(
      many.map((n) => call(client, "capture_add", { title: `capture ${n}` })),
    )
    expect(answered.map((one) => one.isError)).toEqual(many.map(() => false))

    const titles = recordsOf(await set())
      .map((one) => one.node)
      .flatMap((one) => "mirror" in one ? [] : [one.title])
    for (const n of many) expect(titles).toContain(`capture ${n}`)
  })
})

test("every read answers with its age, and a look that agreed says so", async () => {
  await withTools(
    { "house.olai": HOUSE, "notes/cabinets.md": "# Cabinets\n" },
    async ({ client, root }) => {
      for (const [tool, args] of [
        ["outlines_read", { id: "kitchen" }],
        ["outlines_subtree", { id: "kitchen" }],
        ["markdown_read", { file: "notes/cabinets.md" }],
        ["outlines_index", {}],
        ["markdown_index", {}],
        ["search_nodes", { text: "cabinets" }],
      ] as ReadonlyArray<readonly [string, Record<string, unknown>]>) {
        const answered = await call(client, tool, args)
        const vintage = answered.structured["vintage"] as Record<string, unknown>
        expect(vintage).toMatchObject({ stale: false, proof: "confirmed", ageMs: 0 })
        expect(Date.parse(vintage["asOf"] as string)).toBeGreaterThan(0)
        expect(answered.structured["root"]).toBe(root)
      }
    },
  )
})

test("a write's answer carries no age — it is not a read of anything", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client }) => {
    const written = await call(client, "outlines_done", { id: "order" })
    expect(written.isError).toBe(false)
    expect(written.structured["vintage"]).toBeUndefined()
    const answered = await call(client, "outlines_read", { id: "order" })
    expect(answered.structured["vintage"]).toMatchObject({ stale: false })
  })
})

test("PIN (the rebase shape): a read whose set the disk has moved past says so", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, root, read }) => {
    const before = await call(client, "outlines_read", { id: "order" })
    expect(before.structured["vintage"]).toMatchObject({ stale: false })
    const proved = (before.structured["vintage"] as Record<string, unknown>)["asOf"]

    const held = read("house.olai")
    expect(held).not.toBeNull()
    const incoming = path.join(root, ".incoming")
    fs.writeFileSync(incoming, `${held as string}\n`)
    fs.renameSync(incoming, path.join(root, "house.olai"))

    const after = await call(client, "outlines_read", { id: "order" })
    expect(after.isError).toBe(false)
    expect(after.structured["id"]).toBe("order")
    const vintage = after.structured["vintage"] as Record<string, unknown>
    expect(vintage).toMatchObject({ stale: true, proof: "diverged" })
    expect(vintage["diverged"]).toEqual(["house.olai"])
    expect(vintage["asOf"]).toBe(proved)
  })
})

test("PIN (what `stale: false` is worth): a same-stamp rewrite reads confirmed", async () => {
  await withTools({ "house.olai": HOUSE }, async ({ client, root }) => {
    const file = path.join(root, "house.olai")
    const fd = fs.openSync(file, "r+")
    try {
      const stamp = fs.fstatSync(fd)
      const original = fs.readFileSync(fd, "utf8")
      const rewritten = original.replace(
        "order the cabinets",
        "order the CABINETS",
      )
      expect(rewritten).not.toBe(original)
      expect(rewritten.length).toBe(original.length)
      fs.writeSync(fd, rewritten, 0, "utf8")
      fs.futimesSync(fd, stamp.atime, stamp.mtime)
    } finally {
      fs.closeSync(fd)
    }

    const answered = await call(client, "outlines_read", { id: "order" })
    expect(answered.isError).toBe(false)
    expect(answered.structured["title"]).toBe("order the cabinets")
    expect(answered.structured["vintage"]).toMatchObject({
      stale: false,
      proof: "confirmed",
    })
  })
})
