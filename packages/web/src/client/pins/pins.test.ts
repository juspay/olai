/**
 * WHAT IS ON THE SHELF, over the answer the server sends.
 *
 * WHICH TITLES ARE DOORS is one module over and has its own suite
 * (`../address/address.test.ts`); WHICH ROWS TRAVEL and what a pinned node is
 * called are the reading's, on the other side of the wire, and have theirs
 * (`@olai/format`'s `shelf.test.ts`). What is here is what this module is left
 * holding: reading each answered row into a door, and whether a given page is
 * already one.
 */

import type { Shelf } from "@olai/surface"
import { expect, test } from "bun:test"

import { pinnedAt, pinsOf } from "./pins.ts"
import { atNode } from "../routes.ts"

/** The shelf as the `pins` cell carries it — the file's own rows, with the one
 *  fact only the set could answer already on them. */
const ANSWERED: Shelf = [
  { id: "p-herbs", title: "/#herbs", shows: { id: "herbs", name: "the herb bed" } },
  { id: "p-doc", title: "/notes/finishes.md" },
  { id: "p-late", title: "[What is late](/agenda?q=is%3Atodo)" },
  { id: "p-note", title: "the ones I keep coming back to" },
  { id: "p-gone", title: "/#gone" },
]

// ── reading the answer ─────────────────────────────────────────────────

test("the doors are the answered rows whose titles name a page, in order", () => {
  expect(pinsOf(ANSWERED).map((pin) => pin.id)).toEqual([
    "p-herbs",
    "p-doc",
    "p-late",
    "p-gone",
  ])
})

test("what a door is CALLED: the written name, then the set's, then the address", () => {
  expect(pinsOf(ANSWERED).map((pin) => pin.name)).toEqual([
    // The node's own title, as the server answered it.
    "the herb bed",
    // A file names itself — the server says nothing about one, and never did.
    "finishes.md",
    // A name somebody wrote wins over anything derived.
    "What is late",
    // The honest dead row: an address this app can read, at a node the set does
    // not declare.
    "/#gone",
  ])
})

test("a node RENAMED is a new answer, and the shelf says the new name", () => {
  const renamed = ANSWERED.map((row) =>
    row.id === "p-herbs" ? { ...row, shows: { id: "herbs", name: "the herb spiral" } } : row
  )
  expect(pinsOf(renamed)[0]?.name).toBe("the herb spiral")
})

// The two sides read one title with two parsers, each its own half of the seam
// (`./target.test.ts`). Where they agree there is nothing to say; this is what
// the row draws if they ever did not — its own address, never a name for
// somewhere else.
test("a name is spent only where THIS parser agrees the row addresses that node", () => {
  const crossed: Shelf = [
    { id: "p", title: "/#herbs", shows: { id: "elsewhere", name: "the kitchen" } },
  ]
  expect(pinsOf(crossed)[0]?.name).toBe("/#herbs")
})

// A title an escape nothing can read is not a door
// (`../address/address.test.ts`), and what that has to be here is the SHELF
// surviving one: the parse runs during render, so a throw took the sidebar
// down rather than skipping a row (review, 2026-08-18).
test("…and the shelf drawn over one is the shelf without it", () => {
  const shelf: Shelf = [
    { id: "p-bad", title: "/%" },
    { id: "p-good", title: "/agenda" },
  ]
  expect(pinsOf(shelf).map((pin) => pin.id)).toEqual(["p-good"])
})

test("a directory with no shelf, and one whose shelf holds nothing, both draw none", () => {
  expect(pinsOf([])).toEqual([])
})

// ── is this page already on it ─────────────────────────────────────────

test("a page is pinned when the shelf holds its address, however either is spelled", () => {
  expect(pinnedAt(ANSWERED, atNode("herbs"))?.id).toBe("p-herbs")
  expect(pinnedAt(ANSWERED, { kind: "agenda", filter: "is:todo" })?.id).toBe("p-late")
  // The SAME page without its query is a different page, and a different pin.
  expect(pinnedAt(ANSWERED, { kind: "agenda" })).toBeUndefined()
  expect(pinnedAt(ANSWERED, atNode("kitchen"))).toBeUndefined()
  // And a shelf that has answered nothing has nothing pinned, rather than a
  // caller having to ask whether there is one first.
  expect(pinnedAt([], { kind: "agenda" })).toBeUndefined()
})
