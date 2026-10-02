/**
 * The shape this browser keeps done-visibility in, as a pure question: what
 * the default is, what a page's out-vote does to it, and what a page makes of
 * the answer.
 *
 * Both circuits over it are `createPreference`'s (../preference.ts, tested
 * beside it); what is pinned HERE is the arithmetic — the codec spellings,
 * the effective pick's order (override first, default second), and the one
 * wiring fact that is this file's own to hold: an override write starts from
 * the STORED ENTRY unioned with what the tab holds, driven through
 * `setDoneFor` against real (shimmed) storage, for `fold/memory.test.ts`'s
 * reason: no pure test of the helpers can notice the setter forgetting to
 * call them. The e2e feature is what says a pick survives a reload and
 * crosses tabs.
 */
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

/** The two circuits ARE module-level: a test file shares them, the way two
 *  tabs would — and the union-write discipline the tests are FOR is exactly
 *  what makes a later test hear an earlier one. Start each from the panel:
 *  every page this file has ever named goes back to following, and the
 *  default goes back to hidden. Same discipline as `fold/memory.test.ts`'s
 *  order-ing. */
const quiet = (): void => {
  for (const file of ["a.olai", "b.olai", "garden.olai", "house.olai"]) {
    letDoneFollow(file)
  }
  setDoneHidden(true)
}

// ── the default, and the pages that out-vote it ────────────────────────

test("the default is hidden; a page's own word out-votes it either way", () => {
  remembering((store) => {
    quiet()
    expect(doneHidden()).toBe(true)
    expect(doneHiddenOn("house.olai")).toBe(true)
    // The ask: this page shows.
    setDoneFor("house.olai", "shown")
    expect(doneHiddenOn("house.olai")).toBe(false)
    expect(doneOverride("house.olai")).toBe("shown")
    expect(store.get(DONE_OVERRIDES_KEY)).toBe('{"house.olai":"shown"}')
    // ...and its sibling never heard.
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
    // Writing the word the default already says is still an ask: the entry
    // stands, and the page keeps saying it wherever the default moves.
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
      // The entry this tab holds is the parse's, not the bytes': a malformed
      // one goes in as NOTHING and the write comes out a clean spelling.
      setDoneFor("house.olai", "shown")
      expect(store.get(DONE_OVERRIDES_KEY)).toBe('{"house.olai":"shown"}')
      letDoneFollow("house.olai")
    }
  })
})

test("a write keeps the pick of a page this tab never saw", () => {
  remembering((store) => {
    quiet()
    // A sibling tab flipped garden.olai; this tab has not heard yet.
    store.set(DONE_OVERRIDES_KEY, '{"garden.olai":"shown"}')
    setDoneFor("house.olai", "hidden")
    expect(store.get(DONE_OVERRIDES_KEY))
      .toBe('{"garden.olai":"shown","house.olai":"hidden"}')
    // ...and this tab's own release ranks after the union — the page is back
    // to following the panel, and the sibling's word survives.
    letDoneFollow("house.olai")
    expect(store.get(DONE_OVERRIDES_KEY)).toBe('{"garden.olai":"shown"}')
  })
})

test("on a contested key the STORED one wins — a sibling's fresh flip is never reverted by a stale copy", () => {
  remembering((store) => {
    quiet()
    // A started tab and a later sibling share house shown — the only case
    // both maps ever hold one key.
    setDoneFor("house.olai", "shown")
    // The sibling flips the SAME door; this tab's `storage` event hasn't
    // landed (the shipped event order lets a same-process write sit in
    // `value()` for a beat after the entry already says otherwise).
    store.set(DONE_OVERRIDES_KEY, '{"house.olai":"hidden"}')
    expect(doneOverride("house.olai")).toBe("shown")
    // Then THE SAME tab picks another page — the event loop the folds trade
    // on: the fresh stored spelling rides over this tab's stale one in
    // either direction, and the stale copy, which would have otherwise
    // clambered back over a sibling's fresh write, never could.
    setDoneFor("garden.olai", "hidden")
    expect(doneOverride("house.olai")).toBe("hidden")
    expect(store.get(DONE_OVERRIDES_KEY))
      .toBe('{"garden.olai":"hidden","house.olai":"hidden"}')
    // What the union CANNOT see remains the folds' window: a sibling's
    // delete of a key this tab still holds would come back — the one-event-
    // loop addition-dominating trade, named in done.ts's write half.
  })
})

// ── which page a pick is about ─────────────────────────────────────────

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
  // Day stands for the shape: agenda, the trash and a document fall into the
  // same `else`, and pinning one pins the branch.
  expect(pageFileOf({ kind: "day", date: "2026-08-03", groups: [], notes: [] }))
    .toBeUndefined()
})

