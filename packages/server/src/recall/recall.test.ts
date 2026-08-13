/**
 * The semantic index, driven through the embedder SEAM — never a live model.
 *
 * That is the kolu-ci-1 rule made structural: a CI box has no Ollama, so the
 * degradation pin below IS the CI story, and everything semantic is proved
 * against a deterministic fake whose only notion of meaning is a synonym
 * table. Two words that share a concept share a dimension; cosine does the
 * rest, exactly as it will for a real model's vectors.
 *
 * The two PINS the design ships under (docs/brainstorming/hindsight.md):
 *
 *   - DEGRADATION: no embedder → `open` answers `null`, and search through a
 *     `null` recall is byte-for-byte substring (`@olai/ops`' query.test.ts
 *     pins that equality; here we pin the `null`).
 *   - DERIVED: delete the cache and search still answers — substring
 *     immediately (proved while the rebuild is HELD at the seam), semantic
 *     again once the rebuild lands. The cache is a head start, never a truth.
 */

import { NodeServices } from "@effect/platform-node"
import type { OutlineSet } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { Query } from "@olai/ops"
import type { Snapshot } from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, type FileSystem, Latch, type Path, type Scope, SubscriptionRef } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { cacheFile } from "./cache.ts"
import type { Embedder } from "./embedder.ts"
import { open, type Recall } from "./recall.ts"

const HOUSE = {
  "house.jsonl": [
    `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
    `{"id":"buy","parent":"kitchen","ord":"a0","title":"Buy groceries","desc":"milk and eggs"}`,
    `{"id":"leak","parent":"kitchen","ord":"a1","title":"Fix the faucet"}`,
  ].join("\n"),
}

const snapOf = (rev: number, set: OutlineSet): Snapshot<OutlineSet> => ({
  rev,
  value: set,
  changed: ["house.jsonl"],
  removed: [],
})

/** Meaning, as a table: words sharing a row share a dimension. `purchase
 *  food` lands where `Buy groceries` does, and nowhere near the faucet. */
const CONCEPTS: Record<string, number> = {
  buy: 0,
  purchase: 0,
  groceries: 1,
  food: 1,
  fix: 2,
  repair: 2,
  faucet: 3,
  tap: 3,
  kitchen: 4,
  remodel: 5,
  milk: 6,
  eggs: 7,
}

const vectorOf = (text: string): Float32Array => {
  const vector = new Float32Array(8)
  for (const word of text.toLowerCase().split(/\W+/)) {
    const concept = CONCEPTS[word]
    if (concept !== undefined) vector[concept] = (vector[concept] ?? 0) + 1
  }
  return vector
}

/** The fake behind the seam. Records every DOCUMENT batch (what the cache
 *  pins assert on), and can be gated so a test holds the rebuild still. */
const fake = (options?: {
  readonly id?: string
  readonly docBatches?: Array<ReadonlyArray<string>>
  readonly gate?: Effect.Effect<void>
}): Embedder => ({
  id: options?.id ?? "fake/synonyms",
  embed: (kind, texts) =>
    Effect.gen(function*() {
      if (options?.gate !== undefined) yield* options.gate
      if (kind === "document") options?.docBatches?.push([...texts])
      return texts.map(vectorOf)
    }),
})

const run = <A>(
  effect: Effect.Effect<
    A,
    never,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  >,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  )

/** A scratch home for the cache, per test — and the served-path key. */
const scratch = (): { readonly dir: string; readonly root: string } => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-recall-"))
  return { dir, root: path.join(dir, "served") }
}

test("PIN (degradation): no embedder found means no recall at all — `null`, not an error", async () => {
  const { dir, root } = scratch()
  const opened = await run(Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, setOf(HOUSE)),
    )
    return yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(null),
      cacheDir: dir,
    })
  }))
  // The `null` is handed to the ops layer, and `searchWith` over a `null`
  // recall is pinned byte-for-byte equal to substring search in
  // `@olai/ops/src/query.test.ts` — together the two are the contract.
  expect(opened).toBeNull()
  fs.rmSync(dir, { recursive: true, force: true })
})

test("a paraphrase the substring search misses is found once the index settles", async () => {
  const { dir, root } = scratch()
  await run(Effect.gen(function*() {
    const set = setOf(HOUSE)
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake()),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")
    yield* recall.settled

    const derived = Query.index(set)
    // BEFORE: not one of these words appears in any node.
    expect(Query.search(derived, { text: "purchase food" }).total).toBe(0)
    // AFTER: the index reads `Buy groceries` as the same thing said otherwise.
    const merged = yield* Query.searchWith({ derived, recall }, { text: "purchase food" })
    expect(merged.hits.map((hit) => [hit.id, hit.matched]))
      .toEqual([["buy", "meaning"]])
    // …and an unrelated paraphrase finds the other node, not this one.
    const other = yield* Query.searchWith({ derived, recall }, { text: "repair the tap" })
    expect(other.hits.map((hit) => hit.id)).toEqual(["leak"])
  }))
  fs.rmSync(dir, { recursive: true, force: true })
})

test("PIN (derived): delete the cache and search still answers — substring at once, semantic after the rebuild", async () => {
  const { dir, root } = scratch()
  const set = setOf(HOUSE)

  // First serve: build the index, prove the cache slept.
  await run(Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake()),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")
    yield* recall.settled
  }))
  const slept = cacheFile(dir, root)
  expect(fs.existsSync(slept)).toBe(true)

  // The deletion under test.
  fs.rmSync(slept)

  await run(Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    // The rebuild is HELD at the seam, so "immediately" below is literal:
    // the index has nothing yet, and search must not wait for it.
    const gate = yield* Latch.make(false)
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake({ gate: gate.await })),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")

    const derived = Query.index(set)
    const held = yield* Query.searchWith({ derived, recall }, { text: "purchase food" })
    expect(held).toEqual(Query.search(derived, { text: "purchase food" }))

    yield* gate.open
    yield* recall.settled
    const rebuilt = yield* Query.searchWith({ derived, recall }, { text: "purchase food" })
    expect(rebuilt.hits.map((hit) => hit.id)).toEqual(["buy"])
  }))
  fs.rmSync(dir, { recursive: true, force: true })
})

test("the cache is the memory: an unchanged corpus is never re-embedded, a changed node is re-embedded alone", async () => {
  const { dir, root } = scratch()
  const set = setOf(HOUSE)

  const first: Array<ReadonlyArray<string>> = []
  await run(Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake({ docBatches: first })),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")
    yield* recall.settled
  }))
  expect(first.flat()).toHaveLength(3)

  // Second serve over the same truth: the cache answers for every node.
  const second: Array<ReadonlyArray<string>> = []
  await run(Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake({ docBatches: second })),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")
    yield* recall.settled

    // …and a WRITE re-embeds exactly the node it moved. The store publishes a
    // new snapshot; the index diffs by content hash, not by revision.
    const edited = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"buy","parent":"kitchen","ord":"a0","title":"Buy groceries","desc":"milk, eggs, and butter"}`,
        `{"id":"leak","parent":"kitchen","ord":"a1","title":"Fix the faucet"}`,
      ].join("\n"),
    })
    yield* SubscriptionRef.set(snapshot, snapOf(2, edited))
    yield* recall.settled
  }))
  expect(second.flat()).toHaveLength(1)
  expect(second.flat()[0]).toContain("butter")
  fs.rmSync(dir, { recursive: true, force: true })
})

test("a node that leaves a re-read file leaves the index with it", async () => {
  // The reconcile walks only the files a revision says moved, so pruning is
  // the half that cannot be inferred from the walk: an id that used to live
  // in a touched file and no longer does has to be dropped, or the index goes
  // on answering with a node the outlines no longer declare.
  const { dir, root } = scratch()
  await run(Effect.gen(function*() {
    const set = setOf(HOUSE)
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake()),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")
    yield* recall.settled
    expect((yield* recall.nearest("purchase food", 5)).map((near) => near.id))
      .toEqual(["buy"])

    const without = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"leak","parent":"kitchen","ord":"a1","title":"Fix the faucet"}`,
      ].join("\n"),
    })
    yield* SubscriptionRef.set(snapshot, snapOf(2, without))
    yield* recall.settled
    expect(yield* recall.nearest("purchase food", 5)).toEqual([])
  }))
  fs.rmSync(dir, { recursive: true, force: true })
})

test("a cache written beside a different embedder is discarded whole", async () => {
  const { dir, root } = scratch()
  const set = setOf(HOUSE)

  await run(Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake()),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")
    yield* recall.settled
  }))

  // Same corpus, different model: the vectors share no geometry, so every
  // node embeds again rather than one stale space answering for another.
  const rebuilt: Array<ReadonlyArray<string>> = []
  await run(Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.make<Snapshot<OutlineSet> | null>(
      snapOf(1, set),
    )
    const recall = yield* open({
      root,
      snapshot,
      embedder: Effect.succeed(fake({ id: "fake/other", docBatches: rebuilt })),
      cacheDir: dir,
    })
    if (recall === null) throw new Error("the fake embedder was not taken")
    yield* recall.settled
  }))
  expect(rebuilt.flat()).toHaveLength(3)
  fs.rmSync(dir, { recursive: true, force: true })
})
