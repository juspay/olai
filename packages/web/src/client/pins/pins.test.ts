/**
 * WHAT IS ON THE SHELF, over records the format itself walked.
 *
 * WHICH TITLES ARE DOORS is one module over and has its own suite
 * (`../address/address.test.ts`); what is here is the SHELF's own reading —
 * which file it is, which of its rows count, in what order, and whether a
 * given page is already on it.
 */

import { derive } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { pinnedAt, pinsOf } from "./pins.ts"

const PINS = [
  `{"id":"p-herbs","ord":"a0","title":"/#herbs"}`,
  `{"id":"p-doc","ord":"a1","title":"/notes/finishes.md"}`,
  `{"id":"p-late","ord":"a2","title":"[What is late](/agenda?q=is%3Atodo)"}`,
  `{"id":"p-note","ord":"a3","title":"the ones I keep coming back to"}`,
  `{"id":"p-under","parent":"p-herbs","ord":"a0","title":"/#kitchen"}`,
].join("\n")

const GARDEN = `{"id":"herbs","ord":"a0","title":"the herb bed"}`

const setWith = (pins: string) =>
  derive(recordsOf(setOf({ "Pins.olai": pins, "garden.olai": GARDEN })))

// ── the shelf ──────────────────────────────────────────────────────────

test("the shelf is the top level of Pins.olai, in ord order, doors only", () => {
  expect(pinsOf(setWith(PINS)).map((pin) => pin.id)).toEqual([
    "p-herbs",
    "p-doc",
    "p-late",
  ])
})

test("a named pin keeps its name; a bare address has none", () => {
  const pins = pinsOf(setWith(PINS))
  expect(pins.map((pin) => pin.named)).toEqual([undefined, undefined, "What is late"])
})

// A title an escape nothing can read is not a door
// (`../address/address.test.ts`), and what that has to be here is the SHELF
// surviving one: the parse runs during render, so a throw took the sidebar
// down rather than skipping a row (review, 2026-08-18).
test("…and the shelf drawn over one is the shelf without it", () => {
  const shelf = derive(
    recordsOf(setOf({
      "Pins.olai": [
        `{"id":"p-bad","ord":"a0","title":"/%"}`,
        `{"id":"p-good","ord":"a1","title":"/agenda"}`,
      ].join("\n"),
      "garden.olai": GARDEN,
    })),
  )
  expect(pinsOf(shelf).map((pin) => pin.id)).toEqual(["p-good"])
})

test("a directory with no shelf, and one whose shelf holds nothing, both draw none", () => {
  expect(pinsOf(derive(recordsOf(setOf({ "garden.olai": GARDEN }))))).toEqual([])
  expect(pinsOf(undefined)).toEqual([])
})

test("the shelf is found by NAME, wherever the directory keeps it", () => {
  const nested = derive(recordsOf(setOf({ "notes/pins.olai": `{"id":"p","ord":"a0","title":"/agenda"}` })))
  expect(pinsOf(nested).map((pin) => pin.id)).toEqual(["p"])
})

test("a mirror on the shelf is not a pin — a placement is not a door", () => {
  const withMirror = derive(
    recordsOf(setOf({
      "Pins.olai": `{"id":"p-mirror","ord":"a0","mirror":"herbs"}`,
      "garden.olai": GARDEN,
    })),
  )
  expect(pinsOf(withMirror)).toEqual([])
})

// ── is this page already on it ─────────────────────────────────────────

test("a page is pinned when the shelf holds its address, however either is spelled", () => {
  const set = setWith(PINS)
  expect(pinnedAt(set, { kind: "node", id: "herbs" })?.id).toBe("p-herbs")
  expect(pinnedAt(set, { kind: "agenda", filter: "is:todo" })?.id).toBe("p-late")
  // The SAME page without its query is a different page, and a different pin.
  expect(pinnedAt(set, { kind: "agenda" })).toBeUndefined()
  expect(pinnedAt(set, { kind: "node", id: "kitchen" })).toBeUndefined()
  // And a directory with no shelf at all has nothing pinned, rather than a
  // caller having to ask whether there is one first.
  expect(pinnedAt(undefined, { kind: "agenda" })).toBeUndefined()
})
