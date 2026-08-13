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

import { idsByFile, parseFolds, printFolds, pruned, withFolds } from "./memory.ts"

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

test("the fold of a node that is gone is dropped", () => {
  const live = new Map([["house.jsonl", new Set(["kitchen"])]])
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
