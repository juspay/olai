/**
 * THE SAME CLAIM AS `@olai/index`'s OWN TEST, made where the writes are real.
 *
 * That package compares the two answers over readings a test assembles by hand;
 * this compares them over readings the WRITE GATE produced — a temp directory, a
 * store watching it, ops planning and committing into it, and after every op the
 * question asked twice: once through `Ops.search`, which is the door with the
 * index behind it, and once through {@link Query.search} over the very snapshot
 * that door read, with no index at all.
 *
 * Why it is worth a second suite. What the unit test cannot reach is the SEAM:
 * that the reading a search is answered from is the reading the index was
 * brought level with, through a pipeline nobody wrote for this — the probe's
 * stamp diff, the codec's delta, the patcher's shared arrays. A test that
 * assembles its own readings proves the algorithm; this proves the plumbing
 * carries it, which is where an index that is one revision behind would show up
 * and nowhere else.
 *
 * It is deliberately SHORT on grammar and long on writes. Which queries the two
 * paths must agree about is `@olai/index`'s table; what is varied here is what
 * happened to the directory in between.
 */

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
import { orgFixture } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"

import { codecFor } from "./codec.ts"
import type { Store } from "./deps.ts"
import { fixedPolicy } from "./pending.ts"
import { STAMP, steady } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"
import * as Query from "./query.ts"

/** The codec this suite validates through — the vocabulary of a build that
 *  composed no plugin, which is what every test in this package runs under
 *  ({@link ./codec.ts}'s `codecFor`, and `@olai/format`'s `NO_KINDS`). */
const codec = codecFor(NO_KINDS)

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

/** What is re-asked after every write. A short pool on purpose — the long one
 *  is `@olai/index`'s — chosen so that between them they reach every path the
 *  door has: a narrowed query, a narrowed query that finds nothing, one the
 *  trigram floor sends to the corpus, one of operators alone, a phrase, an
 *  `OR`, a scope, and a document. */
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
  { text: "walnut", file: "house.org" },
  { text: "walnut", under: "kitchen" },
  { text: "walnut", kind: "node" },
  { text: "walnut", kind: "document" },
  { text: "finishes" },
  { text: "notes/" },
  { text: "walnut", limit: 2 },
]

/** The two answers, and the whole of what this file asserts. The scan side is
 *  handed the SNAPSHOT the door just read and the same clock the layer gave the
 *  door (`steady`), so the only difference between the two calls is the index. */
const same = (
  ops: Ops.Ops,
  store: Store,
  request: SearchRequest,
): Effect.Effect<SearchAnswer> =>
  Effect.gen(function*() {
    const snapshot = yield* Effect.map(store.read("cheap"), (aged) => aged.snapshot)
    if (snapshot === null) throw new Error("the fixture directory never loaded")
    const walked = Query.search(snapshot.value, request, STAMP, NO_KINDS)
    const indexed = yield* Effect.orDie(ops.search(request))
    expect(indexed).toEqual(walked)
    return walked
  })

/**
 * Listing sizes ≡ recompute-from-body, on the SAME snapshot the index soak
 * just searched. The two seams meet at a document write: `bodiedDocument`
 * remembers `bytes` as it rebuilds the body the index re-folds. A soak that
 * compared searches and not listings would let a spread that swapped `body`
 * and left `bytes` through.
 */
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
    fs.writeFileSync(path.join(root, file), file.endsWith(".org") ? orgFixture(contents) : contents)
  }
  write("house.org", HOUSE)
  write("garden.org", GARDEN)
  write("notes/finishes.md", "---\nagent: claude-opus\n---\n\nThe walnut finish, and brass.\n")
  write("notes/spare.md", "nothing about the kitchen here\n")

  /** The ops in order, each chosen for the shape of edit it makes the index
   *  follow: text arriving, text leaving, a record minted, a file rewritten
   *  whole, a file minted, a subtree crossing into the archive and back, and a
   *  body swapped under a path that already had a row. */
  const WRITES: ReadonlyArray<WriteRequest> = [
    // Text ARRIVES on a record that already had a row.
    { op: "title", id: "install", title: "install the walnut doors" },
    // ...and LEAVES, which is the case a row that is only ever added would
    // answer wrongly and silently.
    { op: "title", id: "order", title: "order the shelves" },
    { op: "desc", id: "order", desc: "no timber at all now" },
    // A NEW record in an existing file.
    { op: "add", parent: "kitchen", title: "the walnut pantry", children: [{ title: "shelves" }] },
    // A record MOVES under a new parent, so its whole file is rewritten and
    // every row of it re-indexed for a change to one line.
    { op: "move", id: "compost", parent: "beds" },
    // A mark, which no index looks at and every `is:` query does.
    { op: "todo", id: "install" },
    { op: "done", id: "beds" },
    // A property, which is a `prop:` query's whole subject and is not text.
    { op: "prop", id: "order", key: "pr", value: "https://x/1" },
    // A WHOLE FILE minted.
    { op: "create", file: "shed.org", seed: { title: "Shed, with walnut trim" } },
    // A record put AWAY — its rows stay, under the archive's path, where only
    // an `is:trashed` query reaches them.
    { op: "trash", id: "demo" },
    // ...and brought back.
    { op: "untrash", id: "demo" },
    // The other arm: a BODY rewritten under a path that already had a row.
    { op: "doc", file: "notes/spare.md", text: "walnut again, and the brass handles\n" },
    // ...and a new document.
    { op: "create-doc", file: "notes/timber.md", text: "# Timber\n\nwalnut, oak, brass\n" },
  ]

  return Effect.gen(function*() {
    const store = yield* StoreModule.make({ root, codec, watch: false, settle: "10 millis" })
    const ops = Ops.make({
      store,
      root,
      policy: fixedPolicy({ commit: "off", push: null }),
      context: steady(),
    })

    // BEFORE anything is written, which is also the first time the index is
    // asked anything at all: the build of a cold table has to answer the same
    // as the walk, not merely the maintenance of a warm one.
    let found = 0
    for (const request of POOL) found += (yield* same(ops, store, request)).total
    yield* sized(store)

    for (const request of WRITES) {
      yield* Effect.orDie(ops.run(request, "mcp"))
      for (const query of POOL) found += (yield* same(ops, store, query)).total
      yield* sized(store)
    }

    // The pool is not all misses: a run where every query found nothing would
    // satisfy every comparison above and prove nothing about either path.
    expect(found).toBeGreaterThan(50)
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
})
