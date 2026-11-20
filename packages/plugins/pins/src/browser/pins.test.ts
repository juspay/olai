import { NO_PINS, type Shelf } from "@olai/format"
import { expect, test } from "bun:test"

import { atNode } from "olai-plugin-navigation/routes"

import { pinnedAt, pinsOf } from "./pins.ts"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
const routes = routingIn()


const ANSWERED: Shelf = [
  { id: "p-herbs", title: "/#herbs", shows: { id: "herbs", name: "the herb bed" } },
  { id: "p-doc", title: "/notes/finishes.md" },
  { id: "p-late", title: "[What is late](/trash?q=is%3Atodo)" },
  { id: "p-note", title: "the ones I keep coming back to" },
  { id: "p-gone", title: "/zoom/#gone" },
]

test("the doors are the answered rows whose titles name a page, in order", () => {
  expect(pinsOf(routes, ANSWERED).map((pin) => pin.id)).toEqual([
    "p-herbs",
    "p-doc",
    "p-late",
    "p-gone",
  ])
})

test("what a door is CALLED: the written name, then the set's, then the address", () => {
  expect(pinsOf(routes, ANSWERED).map((pin) => pin.name)).toEqual([
    "the herb bed",
    "finishes.md",
    "What is late",
    "/zoom/#gone",
  ])
})

test("a node RENAMED is a new answer, and the shelf says the new name", () => {
  const renamed = ANSWERED.map((row) =>
    row.id === "p-herbs" ? { ...row, shows: { id: "herbs", name: "the herb spiral" } } : row
  )
  expect(pinsOf(routes, renamed)[0]?.name).toBe("the herb spiral")
})

test("a name is spent only where THIS parser agrees the row addresses that node", () => {
  const crossed: Shelf = [
    { id: "p", title: "/#herbs", shows: { id: "elsewhere", name: "the kitchen" } },
  ]
  expect(pinsOf(routes, crossed)[0]?.name).toBe("/#herbs")
})

test("…and the shelf drawn over one is the shelf without it", () => {
  const shelf: Shelf = [
    { id: "p-bad", title: "/%" },
    { id: "p-good", title: "/trash" },
  ]
  expect(pinsOf(routes, shelf).map((pin) => pin.id)).toEqual(["p-good"])
})

test("a directory with no shelf, and one whose shelf holds nothing, both draw none", () => {
  expect(pinsOf(routes, NO_PINS)).toEqual([])
})

test("a page is pinned when the shelf holds its address, however either is spelled", () => {
  expect(pinnedAt(routes, ANSWERED, atNode("herbs"))?.id).toBe("p-herbs")
  expect(pinnedAt(routes, ANSWERED, { kind: "trash", filter: "is:todo" })?.id).toBe("p-late")
  expect(pinnedAt(routes, ANSWERED, { kind: "trash" })).toBeUndefined()
  expect(pinnedAt(routes, ANSWERED, atNode("kitchen"))).toBeUndefined()
  expect(pinnedAt(routes, NO_PINS, { kind: "trash" })).toBeUndefined()
})
