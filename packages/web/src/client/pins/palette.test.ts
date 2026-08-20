/**
 * THE ⌘K ROW that pins the page: which of its two labels it wears, and that
 * what it names is the ADDRESS rather than a node.
 *
 * The two facts it reads come from two places, which is what the fixtures here
 * say out loud: the SHELF is the server's answer, and what the page is CALLED
 * is still this tab's own reading of the set.
 */

import { derive } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import type { Shelf } from "@olai/surface"
import { expect, test } from "bun:test"

import { pinItem } from "./palette.ts"
import { atFile, atNode } from "../routes.ts"

const GARDEN = `{"id":"herbs","ord":"a0","title":"the herb bed"}`

const set = derive(recordsOf(setOf({ "garden.olai": GARDEN })))

const EMPTY: Shelf = []

test("a page the shelf does not hold is offered the way ON", () => {
  const item = pinItem({ kind: "agenda", filter: "is:todo" }, EMPTY, set)
  expect(item.label).toBe("Pin this page")
  expect(item.action).toEqual({ kind: "pin" })
})

test("a page the shelf holds — WITH its query — is offered the way OFF", () => {
  const shelf: Shelf = [{ id: "p", title: "/agenda?q=is%3Atodo" }]
  expect(pinItem({ kind: "agenda", filter: "is:todo" }, shelf, set).label)
    .toBe("Unpin this page")
  // The same page unfiltered is a different page, and is not on the shelf.
  expect(pinItem({ kind: "agenda" }, shelf, set).label).toBe("Pin this page")
})

test("the row says WHICH page, because a palette is opened from anywhere", () => {
  expect(pinItem(atNode("herbs"), EMPTY, set).place).toBe("the herb bed")
  expect(pinItem(atFile("notes/x.md"), EMPTY, set).place).toBe("x.md")
})
