/**
 * THE SHELF, READ OFF THE SET.
 *
 * What is pinned here is the half of the shelf that is a question about the
 * DIRECTORY: which file it is, which of that file's rows travel, in what order,
 * and what the set says a pinned node is called right now. Which titles name a
 * PAGE is the browser's parser and has its own suite one package up
 * (`@olai/web`'s `address/address.test.ts`, and `pins/target.test.ts` for the
 * agreement between the two sides).
 */

import { expect, test } from "bun:test"

import { derive } from "./derive.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"
import { NO_PINS, pinTargetIn, sameShelf, shelfOf } from "./shelf.ts"

const PINS = [
  `{"id":"p-herbs","ord":"a0","title":"/#herbs"}`,
  `{"id":"p-doc","ord":"a1","title":"/notes/finishes.md"}`,
  `{"id":"p-late","ord":"a2","title":"[What is late](/agenda?q=is%3Atodo)"}`,
  `{"id":"p-note","ord":"a3","title":"the ones I keep coming back to"}`,
  `{"id":"p-under","parent":"p-herbs","ord":"a0","title":"/#kitchen"}`,
].join("\n")

const GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  `{"id":"kitchen","ord":"a1","title":"the kitchen"}`,
].join("\n")

const setWith = (pins: string, garden = GARDEN) =>
  derive(recordsOf(setOf({ "Pins.olai": pins, "garden.olai": garden })))

// ── the rows ───────────────────────────────────────────────────────────

test("the shelf is the top level of Pins.olai, in ord order, mirrors left out", () => {
  const shelf = shelfOf(setWith(PINS))
  // The note travels: whether a title names a PAGE is the app parser's answer,
  // and this reading does not hold one. What does NOT travel is the row nested
  // under a pin, and a placement, which carries no title to address with.
  expect(shelf.map((row) => row.id)).toEqual(["p-herbs", "p-doc", "p-late", "p-note"])
})

test("a mirror is not a pin — a placement is not a door", () => {
  const withMirror = derive(
    recordsOf(setOf({
      "Pins.olai": `{"id":"p-mirror","ord":"a0","mirror":"herbs"}`,
      "garden.olai": GARDEN,
    })),
  )
  expect(withMirror.byId.has("p-mirror")).toBe(true)
  expect(shelfOf(withMirror)).toEqual(NO_PINS)
})

test("the shelf is found by NAME, wherever the directory keeps it", () => {
  const nested = derive(
    recordsOf(setOf({ "notes/pins.olai": `{"id":"p","ord":"a0","title":"/agenda"}` })),
  )
  expect(shelfOf(nested).map((row) => row.id)).toEqual(["p"])
})

test("a directory with no shelf has none", () => {
  expect(shelfOf(derive(recordsOf(setOf({ "garden.olai": GARDEN }))))).toEqual(NO_PINS)
})

// ── the one thing only the set can answer ──────────────────────────────

test("a node pin carries the name that node has RIGHT NOW", () => {
  expect(shelfOf(setWith(PINS)).find((row) => row.id === "p-herbs")?.shows)
    .toEqual({ id: "herbs", name: "the herb bed" })
  const renamed = setWith(PINS, `{"id":"herbs","ord":"a0","title":"the herb spiral"}`)
  expect(shelfOf(renamed).find((row) => row.id === "p-herbs")?.shows?.name)
    .toBe("the herb spiral")
})

test("a pin to an id nothing declares carries no name — the honest dead row", () => {
  const shelf = shelfOf(setWith(`{"id":"p-gone","ord":"a0","title":"/#gone"}`))
  expect(shelf).toEqual([{ id: "p-gone", title: "/#gone" }])
})

test("…and so does every address that names itself", () => {
  const shelf = shelfOf(setWith(PINS))
  expect(shelf.filter((row) => row.shows !== undefined).map((row) => row.id))
    .toEqual(["p-herbs"])
})

test("a pin at a MIRROR is named for the node standing there", () => {
  const set = derive(
    recordsOf(setOf({
      "Pins.olai": `{"id":"p","ord":"a0","title":"/#m"}`,
      "garden.olai": `${GARDEN}\n{"id":"m","ord":"a2","mirror":"herbs"}`,
    })),
  )
  // The id ECHOED is the one the row addresses — a reader compares it against
  // the address it read — and the name is the node standing at the end of the
  // chain, which is what a reader can be shown.
  expect(shelfOf(set)[0]?.shows).toEqual({ id: "m", name: "the herb bed" })
})

test("the QUALIFIED node spelling resolves to the same node", () => {
  // `garden.olai#herbs` is what somebody writes when they know where the node
  // lives; the grammar normalises the file away, and the browser's parser does
  // too, so both sides land on the same id (`@olai/web`'s `pins/target.test.ts`).
  const set = setWith(`{"id":"p","ord":"a0","title":"/garden.olai#herbs"}`)
  expect(shelfOf(set)[0]?.shows).toEqual({ id: "herbs", name: "the herb bed" })
})

// ── which titles name a node ───────────────────────────────────────────

test("a node address is the one the grammar reads as one", () => {
  expect(pinTargetIn("/#herbs")).toBe("herbs")
  expect(pinTargetIn("[the herb bed](/#herbs)")).toBe("herbs")
  // The query sits between the two halves of a URL, so a narrowed node page is
  // still a node page.
  expect(pinTargetIn("/?q=is%3Atodo#herbs")).toBe("herbs")
  // An id somebody chose, escaped as an address is written.
  expect(pinTargetIn("/#the%20bed")).toBe("the bed")
})

test("everything else names itself, and nothing here throws", () => {
  for (
    const title of [
      "/notes/finishes.md",
      "/notes/finishes.md#install",
      "/agenda?q=is%3Atodo",
      "/today",
      "/d/2026-08-20",
      "/trash",
      "/",
      "the ones I keep coming back to",
      "/etc/passwd",
      // An escape nothing can read names nothing, rather than throwing on the
      // server that answers every open tab.
      "/#%",
      "/%",
      "",
      "see [the agenda](/agenda) tomorrow",
    ]
  ) expect(pinTargetIn(title)).toBeUndefined()
})

// ── what keeps a quiet revision quiet ──────────────────────────────────

test("two readings of one shelf are the same answer; a rename is not", () => {
  const was = shelfOf(setWith(PINS))
  expect(sameShelf(was, shelfOf(setWith(PINS)))).toBe(true)
  expect(sameShelf(was, shelfOf(setWith(PINS, `{"id":"herbs","ord":"a0","title":"beds"}`))))
    .toBe(false)
  expect(sameShelf(was, was.slice(1))).toBe(false)
  expect(sameShelf(NO_PINS, [])).toBe(true)
})
