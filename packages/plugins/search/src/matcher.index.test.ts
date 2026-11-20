import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import {
  bytesOf,
  markdownIn,
  NO_KINDS,
  type SearchAnswer,
  type SearchRequest,
  type WriteRequest,
} from "@olai/format"
import * as StoreModule from "@olai/store"
import { codecFor, make as makeOps, type Ops, Query, type Store } from "@olai/ops"
import { STAMP, steady } from "@olai/ops/testlib"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"

import { search } from "./matcher.ts"
import { open } from "./table.ts"

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel #home"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the walnut cabinets","desc":"from the joiner, in brass"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","doing":"2026-08-02"}`,
  "",
].join("\n")

const GARDEN = [
  `{"id":"garden","ord":"a0","title":"Garden #outside"}`,
  `{"id":"beds","parent":"garden","ord":"a0","title":"raised beds","todo":true,"date":"2026-08-14"}`,
  `{"id":"compost","parent":"garden","ord":"a1","title":"compost the walnut leaves"}`,
  "",
].join("\n")

const POOL: ReadonlyArray<SearchRequest> = [
  { text: "walnut" },
  { text: "cabinets" },
  { text: "remodel" },
  { text: "pantry" },
  { text: "walnut brass" },
  { text: "walnut OR compost" },
  { text: `"the walnut"` },
  { text: "ab" },
  { text: "is:todo" },
  { text: "walnut is:done" },
  { text: "zzzzzzzz" },
  { text: "#home" },
  { text: "joiner", withDesc: true },
  { text: "walnut", file: "house.olai" },
  { text: "walnut", under: "kitchen" },
  { text: "walnut", kind: "node" },
  { text: "walnut", kind: "document" },
  { text: "finishes" },
  { text: "notes/" },
  { text: "walnut", limit: 2 },
]

const same = (
  ops: Ops,
  store: Store,
  request: SearchRequest,
): Effect.Effect<SearchAnswer> =>
  Effect.gen(function*() {
    const snapshot = yield* Effect.map(store.read("cheap"), (aged) => aged.snapshot)
    if (snapshot === null) throw new Error("the fixture directory never loaded")
    const walked = search(snapshot.value, request, STAMP, NO_KINDS)
    const indexed = yield* Effect.orDie(ops.search(request))
    expect(indexed).toEqual(walked)
    return walked
  })

const sized = (store: Store): Effect.Effect<void> =>
  Effect.gen(function*() {
    const snapshot = yield* Effect.map(store.read("cheap"), (aged) => aged.snapshot)
    if (snapshot === null) throw new Error("the fixture directory never loaded")
    const set = snapshot.value.set
    const bodies = new Map<string, string>(
      markdownIn(set).map((entry) => [entry.path, entry.body]),
    )
    for (const row of Query.documents(set)) {
      const body = bodies.get(row.file)
      if (body === undefined) {
        throw new Error(`listed \`${row.file}\` is not a markdown document of the set`)
      }
      if ("unreadable" in row) continue
      expect(row.bytes).toBe(bytesOf(body))
    }
  })

test("every write leaves the indexed door answering what the corpus walk does", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-index-")))
  const write = (file: string, contents: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  write("house.olai", HOUSE)
  write("garden.olai", GARDEN)
  write("notes/finishes.md", "---\nagent: claude-opus\n---\n\nThe walnut finish, and brass.\n")
  write("notes/spare.md", "nothing about the kitchen here\n")

  const WRITES: ReadonlyArray<WriteRequest> = [
    { op: "title", id: "install", title: "install the walnut doors" },
    { op: "title", id: "order", title: "order the shelves" },
    { op: "desc", id: "order", desc: "no timber at all now" },
    { op: "add", parent: "kitchen", title: "the walnut pantry", children: [{ title: "shelves" }] },
    { op: "move", id: "compost", parent: "beds" },
    { op: "todo", id: "install" },
    { op: "done", id: "beds" },
    { op: "prop", id: "order", key: "pr", value: "https://x/1" },
    { op: "create", file: "shed.olai", seed: { title: "Shed, with walnut trim" } },
    { op: "trash", id: "demo" },
    { op: "untrash", id: "demo" },
    { op: "doc", file: "notes/spare.md", text: "walnut again, and the brass handles\n" },
    { op: "create-doc", file: "notes/timber.md", text: "# Timber\n\nwalnut, oak, brass\n" },
  ]

  return Effect.gen(function*() {
    const store = yield* StoreModule.make({ root, codec, watch: false, settle: "10 millis" })
    const index = open()
    const ops = makeOps({claims: { current: TEST_CLAIMS }, format: "outline-olai",
      store,
      root,
      context: steady(),
      search: {
        nodes: ({ at, query, now, kinds }) =>
          Effect.sync(() => search(at, query, now, kinds, index)),
      },
    })

    let found = 0
    for (const request of POOL) found += (yield* same(ops, store, request)).total
    yield* sized(store)

    for (const request of WRITES) {
      yield* Effect.orDie(ops.run(request, "mcp"))
      for (const query of POOL) found += (yield* same(ops, store, query)).total
      yield* sized(store)
    }

    expect(found).toBeGreaterThan(50)
    index.close()
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
})
