import { TEST_CLAIMS } from "@olai/format/testlib"
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
  derive(TEST_CLAIMS, recordsOf(setOf({ "_olai/Pins.olai": pins, "garden.olai": garden })))

test("the shelf is the top level of Pins.olai, in ord order, mirrors left out", () => {
  const shelf = shelfOf(setWith(PINS))
  expect(shelf.map((row) => row.id)).toEqual(["p-herbs", "p-doc", "p-late", "p-note"])
})

test("a mirror is not a pin — a placement is not a door", () => {
  const withMirror = derive(TEST_CLAIMS,
    recordsOf(setOf({
      "_olai/Pins.olai": `{"id":"p-mirror","ord":"a0","mirror":"herbs"}`,
      "garden.olai": GARDEN,
    })),
  )
  expect(withMirror.byId.has("p-mirror")).toBe(true)
  expect(shelfOf(withMirror)).toEqual(NO_PINS)
})

test("the shelf is found by stem under _olai", () => {
  const nested = derive(TEST_CLAIMS,
    recordsOf(setOf({ "_olai/pins.olai": `{"id":"p","ord":"a0","title":"/agenda"}` })),
  )
  expect(shelfOf(nested).map((row) => row.id)).toEqual(["p"])
})

test("a directory with no shelf has none", () => {
  expect(shelfOf(derive(TEST_CLAIMS, recordsOf(setOf({ "garden.olai": GARDEN }))))).toEqual(NO_PINS)
})

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
  const set = derive(TEST_CLAIMS,
    recordsOf(setOf({
      "_olai/Pins.olai": `{"id":"p","ord":"a0","title":"/#m"}`,
      "garden.olai": `${GARDEN}\n{"id":"m","ord":"a2","mirror":"herbs"}`,
    })),
  )
  expect(shelfOf(set)[0]?.shows).toEqual({ id: "m", name: "the herb bed" })
})

test("the QUALIFIED node spelling resolves to the same node", () => {
  const set = setWith(`{"id":"p","ord":"a0","title":"/garden.olai#herbs"}`)
  expect(shelfOf(set)[0]?.shows).toEqual({ id: "herbs", name: "the herb bed" })
})

test("a node address is the one the grammar reads as one", () => {
  expect(pinTargetIn(TEST_CLAIMS, "/#herbs")).toBe("herbs")
  expect(pinTargetIn(TEST_CLAIMS, "/zoom/#herbs")).toBe("herbs")
  expect(pinTargetIn(TEST_CLAIMS, "[the herb bed](/#herbs)")).toBe("herbs")
  expect(pinTargetIn(TEST_CLAIMS, "/?q=is%3Atodo#herbs")).toBe("herbs")
  expect(pinTargetIn(TEST_CLAIMS, "/#the%20bed")).toBe("the bed")
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
      "/#%",
      "/%",
      "",
      "see [the agenda](/agenda) tomorrow",
    ]
  ) expect(pinTargetIn(TEST_CLAIMS, title)).toBeUndefined()
})

test("two readings of one shelf are the same answer; a rename is not", () => {
  const was = shelfOf(setWith(PINS))
  expect(sameShelf(was, shelfOf(setWith(PINS)))).toBe(true)
  expect(sameShelf(was, shelfOf(setWith(PINS, `{"id":"herbs","ord":"a0","title":"beds"}`))))
    .toBe(false)
  expect(sameShelf(was, was.slice(1))).toBe(false)
  expect(sameShelf(NO_PINS, [])).toBe(true)
})
