/**
 * THE ⌘K ROW that pins the page: which of its two labels it wears, and that
 * what it names is the ADDRESS rather than a node.
 *
 * Both facts are the server's and they arrive on two different members, which
 * is what the fixtures here say out loud: the SHELF is the `pins` cell, and
 * what the page is CALLED — when it is a node — is a name off the focused
 * page's own reading.
 */

import { NO_PINS, type Shelf } from "@olai/surface"
import { expect, test } from "bun:test"

import type { Names } from "../names.ts"
import { pinItem } from "./palette.ts"
import { atFile, atNode } from "../routes.ts"

/** The names the focused page was sent with — one node, the one these
 *  fixtures address. */
const set: Names = (id) =>
  id === "herbs" ? { id, title: "the herb bed", file: "garden.olai" } : undefined

test("a page the shelf does not hold is offered the way ON", () => {
  const item = pinItem({ kind: "agenda", filter: "is:todo" }, NO_PINS, set)
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
  expect(pinItem(atNode("herbs"), NO_PINS, set).place).toBe("the herb bed")
  expect(pinItem(atFile("notes/x.md"), NO_PINS, set).place).toBe("x.md")
})
