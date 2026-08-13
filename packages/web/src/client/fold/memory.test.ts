/**
 * The shape this browser keeps folds in, as a pure question: what the entry
 * says, what a fold does to it, and what a write drops on the way past.
 *
 * The signal over it is deliberately not here — it is three lines of
 * `readPreference` / `writePreference` around these functions, and what is
 * worth pinning is the arithmetic they do. The e2e feature is what says a fold
 * survives a reload.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import {
  combined,
  idsByFile,
  parseFolds,
  printFolds,
  pruned,
  withFolds,
} from "./memory.ts"

const foldsOf = (entry: Record<string, ReadonlyArray<string>>) =>
  new Map(Object.entries(entry).map(([file, ids]) => [file, new Set(ids)]))

test("what is stored is collapsed ids, grouped by file", () => {
  const folds = withFolds(new Map(), [
    { id: "kitchen", file: "house.jsonl" },
    { id: "herbs", file: "garden.jsonl" },
  ], true)
  expect(printFolds(folds)).toBe(
    `{"garden.jsonl":["herbs"],"house.jsonl":["kitchen"]}`,
  )
  expect(parseFolds(printFolds(folds))).toEqual(
    foldsOf({ "garden.jsonl": ["herbs"], "house.jsonl": ["kitchen"] }),
  )
})

test("a node folded while another file is open is remembered under ITS file", () => {
  // The mirrors ruling, in the store: `herbs` lives in garden.jsonl, so folding
  // the mirror of it that hangs in house.jsonl is a fact about garden.jsonl —
  // which is what makes both placements read as folded.
  const folds = withFolds(new Map(), [{ id: "herbs", file: "garden.jsonl" }], true)
  expect(folds.get("house.jsonl")).toBeUndefined()
  expect([...(folds.get("garden.jsonl") ?? [])]).toEqual(["herbs"])
})

test("unfolding removes the id, and the last one takes the file with it", () => {
  const folded = foldsOf({ "house.jsonl": ["kitchen", "install"] })
  const one = withFolds(folded, [{ id: "install", file: "house.jsonl" }], false)
  expect([...(one.get("house.jsonl") ?? [])]).toEqual(["kitchen"])

  const none = withFolds(one, [{ id: "kitchen", file: "house.jsonl" }], false)
  expect(none.size).toBe(0)
  // ...and nothing at all is a key REMOVED, not an empty object left behind.
  expect(printFolds(none)).toBeNull()
})

test("a node nobody has touched is simply absent, and therefore open", () => {
  // The default is the SHAPE, not a value: an expand-all over a page nobody
  // has folded writes nothing at all.
  const folds = withFolds(new Map(), [{ id: "kitchen", file: "house.jsonl" }], false)
  expect(printFolds(folds)).toBeNull()
})

test("collapse-all is one write, not one per node", () => {
  const folds = withFolds(new Map(), [
    { id: "kitchen", file: "house.jsonl" },
    { id: "install", file: "house.jsonl" },
    { id: "herbs", file: "garden.jsonl" },
  ], true)
  expect([...(folds.get("house.jsonl") ?? [])].sort()).toEqual(["install", "kitchen"])
  expect([...(folds.get("garden.jsonl") ?? [])]).toEqual(["herbs"])
})

test("a value this app did not write is nothing, and the reader gets the default", () => {
  // Every one of these is "everything is open" rather than an error to report:
  // an older olai, a console, a half-written entry.
  expect(parseFolds(null).size).toBe(0)
  expect(parseFolds("hello").size).toBe(0)
  expect(parseFolds(`["house.jsonl"]`).size).toBe(0)
  expect(parseFolds(`{"house.jsonl":"kitchen"}`).size).toBe(0)
  // ...and a bad member does not condemn the good ones beside it.
  expect(parseFolds(`{"house.jsonl":["kitchen",7,null]}`)).toEqual(
    foldsOf({ "house.jsonl": ["kitchen"] }),
  )
})

test("a node that MOVED to another file keeps its fold, under the new file", () => {
  // The case pruning by bucket alone gets wrong, and it is the ordinary one:
  // `archive` keeps the id and moves the record to `Archive.jsonl`, leaving the
  // source file served with the rest of its nodes. Read as "not declared by
  // house.jsonl any more" that is indistinguishable from a deletion — and the
  // whole point of keying by id is that a fold survives a move.
  const live = new Map([
    ["house.jsonl", new Set(["kitchen", "order"])],
    ["Archive.jsonl", new Set(["install"])],
  ])
  expect(pruned(foldsOf({ "house.jsonl": ["kitchen", "install"] }), live)).toEqual(
    foldsOf({ "house.jsonl": ["kitchen"], "Archive.jsonl": ["install"] }),
  )
})

test("the fold of a node that is gone is dropped", () => {
  // Gone means gone from the whole SET, not from the file it used to be in —
  // which is what the move above is the other side of.
  const live = new Map([
    ["house.jsonl", new Set(["kitchen"])],
    ["garden.jsonl", new Set(["herbs"])],
  ])
  expect(pruned(foldsOf({ "house.jsonl": ["kitchen", "deleted"] }), live)).toEqual(
    foldsOf({ "house.jsonl": ["kitchen"] }),
  )
})

test("a file this browser cannot see keeps its folds", () => {
  // The whole reason the memory is grouped by file. A file that will not parse,
  // or that this directory is not serving right now, says nothing about whether
  // its nodes exist — and pruning against a set that does not contain it would
  // throw away the folds of every outline the reader is not looking at.
  const live = new Map([["house.jsonl", new Set(["kitchen"])]])
  expect(pruned(foldsOf({ "garden.jsonl": ["herbs"] }), live)).toEqual(
    foldsOf({ "garden.jsonl": ["herbs"] }),
  )
  // Nothing loaded at all prunes nothing.
  expect(pruned(foldsOf({ "house.jsonl": ["gone"] }), new Map())).toEqual(
    foldsOf({ "house.jsonl": ["gone"] }),
  )
})

test("an id lives in ONE bucket: folding it where it moved to clears the old one", () => {
  // The write half of the same rule. A stale copy would win anyway — the set
  // every row reads is the union — so "one node, one fold state" has to hold in
  // the storage and not only in the id.
  const stale = foldsOf({ "house.jsonl": ["install"] })
  expect(withFolds(stale, [{ id: "install", file: "Archive.jsonl" }], true))
    .toEqual(foldsOf({ "Archive.jsonl": ["install"] }))
  // ...and unfolding finds it wherever it is, not only under the file named.
  expect(withFolds(stale, [{ id: "install", file: "Archive.jsonl" }], false))
    .toEqual(new Map())
})

test("a write starts from the ENTRY unioned with what this tab holds", () => {
  // Two tabs are not making rival picks the way two theme presses are: they are
  // each adding a different fact. Starting from the held map alone is how one
  // tab's fold disappears when the other writes from a map that predates it.
  const stored = foldsOf({ "house.jsonl": ["kitchen"] })
  const held = foldsOf({ "garden.jsonl": ["herbs"] })
  expect(combined(stored, held)).toEqual(
    foldsOf({ "house.jsonl": ["kitchen"], "garden.jsonl": ["herbs"] }),
  )
  // The same file from both sides is one bucket, not two.
  expect(combined(stored, foldsOf({ "house.jsonl": ["order"] }))).toEqual(
    foldsOf({ "house.jsonl": ["kitchen", "order"] }),
  )
  // A browser that will not give its storage back reads as nothing, and then
  // the union is exactly what this tab is holding.
  expect(combined(parseFolds(null), held)).toEqual(held)
})

test("an unfold still removes, because the change goes on after the union", () => {
  const base = combined(
    foldsOf({ "house.jsonl": ["kitchen", "order"] }),
    foldsOf({ "house.jsonl": ["kitchen"] }),
  )
  expect(withFolds(base, [{ id: "kitchen", file: "house.jsonl" }], false)).toEqual(
    foldsOf({ "house.jsonl": ["order"] }),
  )
})

test("what a file declares is read off the set the browser is holding", () => {
  const derived = derive(
    setOf({
      "house.jsonl": `{"id":"kitchen","ord":"a0","title":"kitchen"}`,
      "garden.jsonl": [
        `{"id":"garden","ord":"a0","title":"garden"}`,
        `{"id":"herbs","parent":"garden","ord":"a0","title":"herbs"}`,
      ].join("\n"),
    }).nodes,
  )
  expect(idsByFile(derived)).toEqual(
    new Map([
      ["house.jsonl", new Set(["kitchen"])],
      ["garden.jsonl", new Set(["garden", "herbs"])],
    ]),
  )
})
