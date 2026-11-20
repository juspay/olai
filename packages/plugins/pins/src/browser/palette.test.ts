import { NO_PINS, type Shelf } from "@olai/format"
import { expect, test } from "bun:test"

import { pinItem } from "./palette.ts"
import { atFile, atNode } from "olai-plugin-navigation/routes"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
const routes = routingIn()


test("a page the shelf does not hold is offered the way ON", () => {
  const item = pinItem(routes, { kind: "trash" }, NO_PINS, "Trash")
  expect(item.label).toBe("Pin this page")
  expect(item.action).toEqual({ kind: "pin" })
})

test("a NARROWED page says it will ask, in the app's own punctuation", () => {
  expect(pinItem(routes, { kind: "trash", filter: "is:todo" }, NO_PINS, "Trash").label)
    .toBe("Pin this page…")
})

test("a page the shelf holds — WITH its query — is offered the way OFF", () => {
  const shelf: Shelf = [{ id: "p", title: "/trash?q=is%3Atodo" }]
  expect(pinItem(routes, { kind: "trash", filter: "is:todo" }, shelf, "Trash").label)
    .toBe("Unpin this page")
  expect(pinItem(routes, { kind: "trash" }, shelf, "Trash").label).toBe("Pin this page")
})

test("the row says WHICH page, because a palette is opened from anywhere", () => {
  expect(pinItem(routes, atNode("herbs"), NO_PINS, "the herb bed").place).toBe("the herb bed")
  expect(pinItem(routes, atFile("notes/x.md"), NO_PINS, "x.md").place).toBe("x.md")
})
