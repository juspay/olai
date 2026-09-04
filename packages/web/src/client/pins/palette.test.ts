/**
 * THE ⌘K ROW that pins the page: which of its three labels it wears, and that
 * what it names is the ADDRESS rather than a node.
 *
 * The two facts it reads are the server's and they arrive on two different
 * members, which is what the fixtures here say out loud: the SHELF is the
 * `pins` cell, and what the page is CALLED — when it is a node — is a name off
 * the focused page's own reading, resolved by the palette before this is
 * called.
 */

import { NO_PINS, type Shelf } from "@olai/surface"
import { expect, test } from "bun:test"

import { pinItem } from "./palette.ts"
import { atFile, atNode } from "../routes.ts"

test("a page the shelf does not hold is offered the way ON", () => {
  const item = pinItem({ kind: "trash" }, NO_PINS, "Trash")
  expect(item.label).toBe("Pin this page")
  expect(item.action).toEqual({ kind: "pin" })
})

test("a NARROWED page says it will ask, in the app's own punctuation", () => {
  // The ellipsis is what every verb that asks something first wears here, and
  // a narrowed page is the one address whose name nothing can derive
  // (`./naming.ts`).
  expect(pinItem({ kind: "trash", filter: "is:todo" }, NO_PINS, "Trash").label)
    .toBe("Pin this page…")
})

test("a page the shelf holds — WITH its query — is offered the way OFF", () => {
  const shelf: Shelf = [{ id: "p", title: "/trash?q=is%3Atodo" }]
  expect(pinItem({ kind: "trash", filter: "is:todo" }, shelf, "Trash").label)
    .toBe("Unpin this page")
  // The same page unfiltered is a different page, and is not on the shelf.
  expect(pinItem({ kind: "trash" }, shelf, "Trash").label).toBe("Pin this page")
})

test("the row says WHICH page, because a palette is opened from anywhere", () => {
  expect(pinItem(atNode("herbs"), NO_PINS, "the herb bed").place).toBe("the herb bed")
  expect(pinItem(atFile("notes/x.md"), NO_PINS, "x.md").place).toBe("x.md")
})
