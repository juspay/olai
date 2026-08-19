/**
 * THE ⌘K ROW that pins the page: which of its two labels it wears, and that
 * what it names is the ADDRESS rather than a node.
 */

import { derive } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { pinItem } from "./palette.ts"
import { atFile, atNode } from "../routes.ts"

const GARDEN = `{"id":"herbs","ord":"a0","title":"the herb bed"}`

const derived = (pins: string) =>
  derive(recordsOf(setOf({ "garden.olai": GARDEN, "Pins.olai": pins })))

test("a page the shelf does not hold is offered the way ON", () => {
  const item = pinItem({ kind: "agenda", filter: "is:todo" }, derived(""))
  expect(item.label).toBe("Pin this page")
  expect(item.action).toEqual({ kind: "pin" })
})

test("a page the shelf holds — WITH its query — is offered the way OFF", () => {
  const shelf = derived(`{"id":"p","ord":"a0","title":"/agenda?q=is%3Atodo"}`)
  expect(pinItem({ kind: "agenda", filter: "is:todo" }, shelf).label).toBe("Unpin this page")
  // The same page unfiltered is a different page, and is not on the shelf.
  expect(pinItem({ kind: "agenda" }, shelf).label).toBe("Pin this page")
})

test("the row says WHICH page, because a palette is opened from anywhere", () => {
  expect(pinItem(atNode("herbs"), derived("")).place).toBe("the herb bed")
  expect(pinItem(atFile("notes/x.md"), derived("")).place).toBe("x.md")
})
