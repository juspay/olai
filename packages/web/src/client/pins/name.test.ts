/**
 * WHAT A PINNED ADDRESS IS CALLED — and, for the one kind of pin that names a
 * node, that the answer is read off the set every time rather than stored.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { nameOf, narrowingOf } from "./name.ts"

const derived = (title: string) =>
  derive(setOf({ "garden.olai": `{"id":"herbs","ord":"a0","title":"${title}"}` }).nodes)

test("a pinned node is called whatever it is called right now", () => {
  expect(nameOf({ kind: "node", id: "herbs" }, derived("the herb bed"))).toBe("the herb bed")
  // The same pin, after somebody renamed the node somewhere else entirely.
  expect(nameOf({ kind: "node", id: "herbs" }, derived("the herb spiral")))
    .toBe("the herb spiral")
})

test("a pin at an id nothing declares says the address rather than a blank", () => {
  expect(nameOf({ kind: "node", id: "gone" }, derived("the herb bed"))).toBe("/n/gone")
  expect(nameOf({ kind: "node", id: "herbs" }, undefined)).toBe("/n/herbs")
})

test("a mirror's id resolves to the node it stands for", () => {
  const set = derive(
    setOf({
      "garden.olai": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
      "house.olai": `{"id":"here","ord":"a0","mirror":"herbs"}`,
    }).nodes,
  )
  expect(nameOf({ kind: "node", id: "here" }, set)).toBe("the herb bed")
})

test("a file is called by its own name, not by its path", () => {
  const set = derived("the herb bed")
  expect(nameOf({ kind: "document", file: "notes/finishes.md" }, set)).toBe("finishes.md")
  expect(nameOf({ kind: "outline", file: "a/b/garden.olai" }, set)).toBe("garden.olai")
})

test("the pages that are not files are called what a reader calls them", () => {
  const set = derived("the herb bed")
  expect(nameOf({ kind: "outline", file: null }, set)).toBe("Home")
  expect(nameOf({ kind: "day", date: "2026-08-18" }, set)).toBe("2026-08-18")
  expect(nameOf({ kind: "today" }, set)).toBe("Today")
  expect(nameOf({ kind: "agenda" }, set)).toBe("Agenda")
  expect(nameOf({ kind: "trash" }, set)).toBe("Trash")
})

test("the query is its own answer, and empty for a whole page", () => {
  expect(narrowingOf({ kind: "agenda", filter: "is:todo" })).toBe("is:todo")
  expect(narrowingOf({ kind: "agenda" })).toBe("")
  expect(narrowingOf({ kind: "document", file: "x.md" })).toBe("")
})
