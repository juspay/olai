import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, rowsOf, zoom } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { afterAll, expect, test } from "bun:test"

import { remembering } from "@olai/web/client/preference.testlib.ts"

import {
  createDoneReveals, holdDoneReveals,
  doneHidden,
  doneHiddenOn,
  doneOverride,
  DONE_OVERRIDES_KEY,
  letDoneFollow,
  pageFileOf,
  setDoneFor,
  setDoneHidden,
} from "./done.ts"

const releaseReveals = holdDoneReveals(createDoneReveals())
afterAll(releaseReveals)

const quiet = (): void => {
  for (const file of ["a.olai", "b.olai", "garden.olai", "house.olai"]) {
    letDoneFollow(file)
  }
  setDoneHidden(true)
}

test("the default is hidden; a page's own word out-votes it either way", () => {
  remembering((store) => {
    quiet()
    expect(doneHidden()).toBe(true)
    expect(doneHiddenOn("house.olai")).toBe(true)
    setDoneFor("house.olai", "shown")
    expect(doneHiddenOn("house.olai")).toBe(false)
    expect(doneOverride("house.olai")).toBe("shown")
    expect(store.get(DONE_OVERRIDES_KEY)).toBe('{"house.olai":"shown"}')
    expect(doneHiddenOn("garden.olai")).toBe(true)
  })
})

test("a page can also out-vote a SHOWN default — the map holds both words", () => {
  remembering((store) => {
    quiet()
    setDoneHidden(false)
    expect(doneHiddenOn("house.olai")).toBe(false)
    setDoneFor("house.olai", "hidden")
    expect(doneHiddenOn("house.olai")).toBe(true)
    expect(store.get(DONE_OVERRIDES_KEY)).toBe('{"house.olai":"hidden"}')
    setDoneFor("garden.olai", "shown")
    expect(store.get(DONE_OVERRIDES_KEY))
      .toBe('{"garden.olai":"shown","house.olai":"hidden"}')
  })
})

test("the spelling is sorted, so one map has one spelling; empty is no entry", () => {
  remembering((store) => {
    quiet()
    setDoneFor("b.olai", "shown")
    setDoneFor("a.olai", "hidden")
    expect(store.get(DONE_OVERRIDES_KEY))
      .toBe('{"a.olai":"hidden","b.olai":"shown"}')
    setDoneFor("a.olai", "shown")
    setDoneFor("b.olai", "shown")
    letDoneFollow("a.olai")
    letDoneFollow("b.olai")
    expect(store.has(DONE_OVERRIDES_KEY)).toBe(false)
  })
})

test("a value this app did not write reads as no overrides", () => {
  remembering((store) => {
    quiet()
    for (const bad of ["not json", '["house.olai"]', '{"a.olai":true}', "42"]) {
      store.set(DONE_OVERRIDES_KEY, bad)
      setDoneFor("house.olai", "shown")
      expect(store.get(DONE_OVERRIDES_KEY)).toBe('{"house.olai":"shown"}')
      letDoneFollow("house.olai")
    }
  })
})

test("a write keeps the pick of a page this tab never saw", () => {
  remembering((store) => {
    quiet()
    store.set(DONE_OVERRIDES_KEY, '{"garden.olai":"shown"}')
    setDoneFor("house.olai", "hidden")
    expect(store.get(DONE_OVERRIDES_KEY))
      .toBe('{"garden.olai":"shown","house.olai":"hidden"}')
    letDoneFollow("house.olai")
    expect(store.get(DONE_OVERRIDES_KEY)).toBe('{"garden.olai":"shown"}')
  })
})

test("on a contested key the STORED one wins — a sibling's fresh flip is never reverted by a stale copy", () => {
  remembering((store) => {
    quiet()
    setDoneFor("house.olai", "shown")
    store.set(DONE_OVERRIDES_KEY, '{"house.olai":"hidden"}')
    expect(doneOverride("house.olai")).toBe("shown")
    setDoneFor("garden.olai", "hidden")
    expect(doneOverride("house.olai")).toBe("hidden")
    expect(store.get(DONE_OVERRIDES_KEY))
      .toBe('{"garden.olai":"hidden","house.olai":"hidden"}')
  })
})

const derived = derive(TEST_CLAIMS,
  nodesOfFiles({
    "house.olai": [
      `{"id":"kitchen","ord":"a0","title":"kitchen #home"}`,
      `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
    ].join("\n"),
  }),
)
const house = {
  kind: "outline" as const,
  file: "house.olai",
  rows: rowsOf(derived, "house.olai"),
}

test("an outline is about its own file", () => {
  expect(pageFileOf(house)).toBe("house.olai")
  expect(pageFileOf(undefined)).toBeUndefined()
})

test("a zoom is about the outline its node is canonical in — the same page", () => {
  expect(
    pageFileOf({ kind: "node", zoomed: zoom(derived, "kitchen"), backlinks: [] }),
  ).toBe("house.olai")
})

test("a day is about nothing — the arm every non-tree page takes", () => {
  expect(pageFileOf({ kind: "day", date: "2026-08-03", groups: [], notes: [] }))
    .toBeUndefined()
})

