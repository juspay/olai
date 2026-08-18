/**
 * WHAT COUNTS AS A PIN — the one rule the shelf is built on, over records the
 * format itself walked.
 *
 * The interesting half is the refusals: `Pins.olai` is an ordinary outline, so
 * a person and an agent may write a heading, a note or a nested checklist into
 * it, and none of those is a door. What decides is the BIJECTION
 * (`../routes.ts`), which is why a title that merely begins with a slash reads
 * as text.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { hrefOf } from "../routes.ts"
import { addressIn, pinnedAt, pinsOf } from "./pins.ts"

const PINS = [
  `{"id":"p-herbs","ord":"a0","title":"/n/herbs"}`,
  `{"id":"p-doc","ord":"a1","title":"/doc/notes/finishes.md"}`,
  `{"id":"p-late","ord":"a2","title":"[What is late](/agenda?q=is%3Atodo)"}`,
  `{"id":"p-note","ord":"a3","title":"the ones I keep coming back to"}`,
  `{"id":"p-under","parent":"p-herbs","ord":"a0","title":"/n/kitchen"}`,
].join("\n")

const GARDEN = `{"id":"herbs","ord":"a0","title":"the herb bed"}`

const setWith = (pins: string) =>
  derive(setOf({ "Pins.olai": pins, "garden.olai": GARDEN }).nodes)

// ── the rule ───────────────────────────────────────────────────────────

test("an address this app would mint is a pin, whatever page it names", () => {
  for (const address of [
    "/n/herbs",
    "/doc/notes/finishes.md",
    "/o/garden.olai",
    "/d/2026-08-18",
    "/today",
    "/agenda",
    "/trash",
    "/",
  ]) {
    expect(hrefOf(addressIn(address)!)).toBe(address)
  }
})

test("the query rides along, and is read back as the filter it is", () => {
  const route = addressIn("/agenda?q=is%3Atodo")
  expect(route).toEqual({ kind: "agenda", filter: "is:todo" })
})

test("a query somebody wrote by hand is the same pin as the one a browser mints", () => {
  // `?q=is:todo` and `?q=is%3Atodo` are one filter spelled two ways, and a
  // shelf that told them apart would refuse a pin for its punctuation.
  expect(addressIn("/agenda?q=is:todo")).toEqual(addressIn("/agenda?q=is%3Atodo"))
})

test("a title that merely begins with a slash is a title, not a door", () => {
  // `routeOf` answers the front page for anything it does not recognise, which
  // is the right kindness in the address bar and would make every such row a
  // pin to `/` here.
  expect(addressIn("/etc/passwd")).toBeUndefined()
  expect(addressIn("/notes and things")).toBeUndefined()
})

test("ordinary prose is not a pin", () => {
  expect(addressIn("the ones I keep coming back to")).toBeUndefined()
  expect(addressIn("")).toBeUndefined()
})

test("a markdown link is a NAMED pin; a blank label is no name", () => {
  const named = "[What is late](/agenda?q=is%3Atodo)"
  expect(hrefOf(addressIn(named)!)).toBe("/agenda?q=is%3Atodo")
  expect(addressIn("[](/n/herbs)")).toEqual({ kind: "node", id: "herbs" })
})

test("prose either side of a link is a sentence, not a pin", () => {
  // A row of `Pins.olai` may be a note about the shelf. Reading one as a door
  // would put a sentence in the sidebar.
  expect(addressIn("see [the agenda](/agenda) tomorrow")).toBeUndefined()
})

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

test("a directory with no shelf, and one whose shelf holds nothing, both draw none", () => {
  expect(pinsOf(derive(setOf({ "garden.olai": GARDEN }).nodes))).toEqual([])
  expect(pinsOf(undefined)).toEqual([])
})

test("the shelf is found by NAME, wherever the directory keeps it", () => {
  const nested = derive(setOf({ "notes/pins.olai": `{"id":"p","ord":"a0","title":"/agenda"}` }).nodes)
  expect(pinsOf(nested).map((pin) => pin.id)).toEqual(["p"])
})

test("a mirror on the shelf is not a pin — a placement is not a door", () => {
  const withMirror = derive(
    setOf({
      "Pins.olai": `{"id":"p-mirror","ord":"a0","mirror":"herbs"}`,
      "garden.olai": GARDEN,
    }).nodes,
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
