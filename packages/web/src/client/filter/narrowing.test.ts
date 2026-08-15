/**
 * The order of the two prunings, and the counts that make it legible.
 *
 * What a query SELECTS is `@olai/format`'s and is tested there (`filter.test.ts`
 * holds the grammar). What is pinned here is the browser's own decision: the
 * done preference goes first, the filter reads what it left, and the number of
 * matches it held back is said out loud rather than left as a mystery.
 *
 * Each case builds the reading over a FIXED query rather than typing into a
 * signal, which is deliberate: under `bun test` there is no DOM, so `solid-js`
 * resolves to its server build and a memo is computed once instead of tracking.
 * Nothing here is a claim about Solid's graph — it is a claim about what this
 * file computes from three inputs, and that is exactly what a fixed query asks.
 */

import { derive, type Row, rowsOf, withoutDone } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { createNarrowing, type Narrowing } from "./narrowing.ts"

const derived = derive(nodesOfFiles({
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":true}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters #home","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets"}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges #home","todo":true}`,
  ].join("\n"),
}))

/** The page, at one query and one preference — the same three inputs
 *  `App.tsx` hands over. */
const page = (text: string, hideDone = false): Narrowing => {
  const all = (): ReadonlyArray<Row> => rowsOf(derived, "house.olai")
  return createRoot(() =>
    createNarrowing({
      derived: () => derived,
      text: () => text,
      all,
      visible: () => (hideDone ? withoutDone(all()) : all()),
    })
  )
}

test("an empty box is not a filter, and the page is the page", () => {
  const narrowing = page("")
  expect(narrowing.active()).toBe(false)
  expect(narrowing.rows()).toHaveLength(1)
  // The counts are only ever drawn beside an active filter, so an unfiltered
  // page does not walk its own tree to produce them.
  expect(narrowing.total()).toBe(0)
  expect(narrowing.shown()).toBe(0)
})

test("a filtered page counts the rows it draws, of the rows it holds", () => {
  const narrowing = page("hinges")
  expect(narrowing.shown()).toBe(1)
  expect(narrowing.total()).toBe(5)
})

test("a query keeps its matches and the ancestors that lead to them", () => {
  const narrowing = page("hinges")
  expect(narrowing.active()).toBe(true)
  expect(narrowing.shown()).toBe(1)
  // `kitchen` → `install` → `hinges`: one match, two ancestors kept as the
  // context that makes a bare title mean something.
  expect(flat(narrowing.rows())).toEqual(["kitchen", "install", "hinges"])
})

// The preference is a standing claim about the READER; the filter is a question
// about the page. So the preference goes first — and the consequence is said
// rather than special-cased.
test("finished work is hidden before the query is asked, and the difference is reported", () => {
  const showing = page("#home")
  expect(showing.shown()).toBe(3)
  expect(showing.hiddenAsDone()).toBe(0)

  // `demo` carries `#home` and is done: it is not on the page to be matched.
  const hiding = page("#home", true)
  expect(hiding.shown()).toBe(2)
  expect(hiding.hiddenAsDone()).toBe(1)
})

test("`is:done` under a reader who hides finished work says why it found nothing", () => {
  const hiding = page("is:done", true)
  expect(hiding.rows()).toEqual([])
  expect(hiding.shown()).toBe(0)
  expect(hiding.hiddenAsDone()).toBe(1)
})

// A query the grammar could not read is ACTIVE — the bar stays up, the tree
// empties, and the refusal is what the reader is shown. Answering with the half
// that parsed would be a list that looks like an answer.
test("a refused operator empties the page and carries its reason", () => {
  const narrowing = page("is:blocked")
  expect(narrowing.active()).toBe(true)
  expect(narrowing.rows()).toEqual([])
  expect(narrowing.refusals().map((one) => one.token)).toEqual(["is:blocked"])
})

const flat = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [row.at.node.id, ...flat(row.children)])
