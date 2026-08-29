/**
 * The shape this browser keeps done-visibility in, as a pure question: what
 * the entry says, what a pick does to it, and what a page makes of the answer.
 *
 * The circuit over it is `createPreference`'s (../preference.ts, tested beside
 * it); what is pinned HERE is the arithmetic — plus the one wiring fact that
 * is this file's own to hold: a write starts from the STORED ENTRY unioned
 * with what the tab holds, driven through `setDoneHidden` against real
 * (shimmed) storage, for `fold/memory.test.ts`'s reason: no pure test of the
 * helpers can notice the setter forgetting to call them. The e2e feature is
 * what says a pick survives a reload and crosses tabs.
 */

import { derive, rowsOf, zoom } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { remembering } from "../preference.testlib.ts"

import {
  doneHiddenOn,
  DONE_SHOWN_KEY,
  pageFileOf,
  parseShownPages,
  printShownPages,
  setDoneHidden,
  visibleIn,
} from "./done.ts"

// ── the entry ──────────────────────────────────────────────────────────

test("what is stored is the pages that show — the default is not stored", () => {
  expect(printShownPages(new Set())).toBe(null)
  expect(printShownPages(new Set(["garden.olai"]))).toBe('["garden.olai"]')
})

test("the spelling is sorted, so one set has one spelling", () => {
  expect(printShownPages(new Set(["b.olai", "a.olai"]))).toBe('["a.olai","b.olai"]')
})

test("a value this app did not write reads as nothing — the default", () => {
  expect(parseShownPages(null)).toEqual(new Set())
  expect(parseShownPages("not json")).toEqual(new Set())
  expect(parseShownPages('{"a.olai":true}')).toEqual(new Set())
  // ...and an entry half of it: the pages that are strings load, the rest go.
  expect(parseShownPages('["a.olai",42]')).toEqual(new Set(["a.olai"]))
})

// ── which page a pick is about ─────────────────────────────────────────

const derived = derive(nodesOfFiles({
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen #home"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
  ].join("\n"),
}))
const house = { kind: "outline" as const, file: "house.olai", rows: rowsOf(derived, "house.olai") }

test("an outline is about its own file", () => {
  expect(pageFileOf(house)).toBe("house.olai")
  expect(pageFileOf(undefined)).toBeUndefined()
})

test("a zoom is about the outline its node is canonical in — the same page", () => {
  expect(pageFileOf({ kind: "node", zoomed: zoom(derived, "kitchen"), backlinks: [] }))
    .toBe("house.olai")
})

test("a day is about nothing — the arm every non-tree page takes", () => {
  // Day stands for the shape: agenda, the trash and a document fall into the
  // same `else`, and pinning one pins the branch.
  expect(pageFileOf({ kind: "day", date: "2026-08-03", groups: [], notes: [] }))
    .toBeUndefined()
})

// ── the pick, and what a page does with it ─────────────────────────────

test("every page hides until it is asked; a pick is one page's and writes the entry", () => {
  remembering((store) => {
    expect(doneHiddenOn("house.olai")).toBe(true)
    setDoneHidden("house.olai", false)
    // ONE page's: the sibling outline is untouched, and the pick is stored.
    expect(doneHiddenOn("house.olai")).toBe(false)
    expect(doneHiddenOn("garden.olai")).toBe(true)
    expect(store.get(DONE_SHOWN_KEY)).toBe('["house.olai"]')
    // Back to the default is a removal: hiding is not something to remember.
    setDoneHidden("house.olai", true)
    expect(doneHiddenOn("house.olai")).toBe(true)
    expect(store.has(DONE_SHOWN_KEY)).toBe(false)
  })
})

test("a write keeps the pick of a page this tab never saw", () => {
  remembering((store) => {
    // A sibling tab flipped garden.olai; this tab has not heard yet.
    store.set(DONE_SHOWN_KEY, '["garden.olai"]')
    setDoneHidden("house.olai", false)
    expect(store.get(DONE_SHOWN_KEY)).toBe('["garden.olai","house.olai"]')
    // ...and the UN-flip cannot be saved by the union either.
    setDoneHidden("garden.olai", true)
    expect(store.get(DONE_SHOWN_KEY)).toBe('["house.olai"]')
  })
})

test("the rows a page draws: done out when hiding, the same array when showing", () => {
  remembering(() => {
    // The pick is a module-level circuit, and an earlier test may have flipped
    // this page: say where it starts rather than asking for the default.
    setDoneHidden("house.olai", true)
    const drawn = { kind: "tree" as const, rows: house.rows }
    const hiding = visibleIn(drawn, "house.olai")
    expect(hiding).not.toBe(drawn)
    // `demo` is done: the one root stays, its done child is the row that goes.
    expect(hiding.kind === "tree" && hiding.rows[0]?.children.length).toBe(0)

    setDoneHidden("house.olai", false)
    // THE IDENTITY CONTRACT: the count of held-back matches reads this as its
    // zero (../filter/narrowing.ts), so showing must hand the value back
    // rather than rewrap it.
    expect(visibleIn(drawn, "house.olai")).toBe(drawn)
  })
})

test("the pick reaches a tree and nothing else", () => {
  remembering(() => {
    const day = { kind: "day" as const, groups: [], notes: [] }
    // Even on a page that SHOWS: a day is a record of what happened, and this
    // preference was never asked about it (the file argument is the tree's).
    expect(visibleIn(day, "house.olai")).toBe(day)
    // A tree with NO page to be about is not pruned either: with hidden the
    // default, this is the one arm that does the opposite — there is no file
    // for a pick to be read off, so the unpruned value stands (unreachable
    // in practice: the no-file tree is the empty zoom, which holds no rows).
    expect(visibleIn({ kind: "tree", rows: house.rows }, undefined)).toEqual({
      kind: "tree",
      rows: house.rows,
    })
  })
})
