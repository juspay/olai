import { expect, test } from "bun:test"

import type { Tab } from "./contract.ts"
import {
  closeOthers,
  closeTab,
  duplicateTab,
  nextId,
  openTab,
  reorderTabs,
  showTab,
  stepFront,
  type TabList,
  updateTab,
} from "./list.ts"

const tab = (id: string, href = `/${id}.olai`): Tab => ({ id, href, title: id })
const list = (front: string, ...ids: ReadonlyArray<string>): TabList => ({ tabs: ids.map((id) => tab(id)), front })
const ids = (one: TabList) => one.tabs.map((each) => each.id)
const home = () => tab("home", "/")

test("a tab opens right after the one in front, and comes forward unless behind", () => {
  const before = list("b", "a", "b", "c")
  const behind = openTab(before, tab("n"), true)
  expect(ids(behind)).toEqual(["a", "b", "n", "c"])
  expect(behind.front).toBe("b")
  expect(openTab(before, tab("n"), false).front).toBe("n")
})

test("showing a tab changes only the front, and an unknown id changes nothing", () => {
  const before = list("a", "a", "b")
  expect(showTab(before, "b")).toEqual({ ...before, front: "b" })
  expect(showTab(before, "zz")).toBe(before)
})

test("closing the front tab brings its right neighbour forward, else its left", () => {
  expect(closeTab(list("b", "a", "b", "c"), "b", home)).toEqual(list("c", "a", "c"))
  expect(closeTab(list("c", "a", "b", "c"), "c", home)).toEqual(list("b", "a", "b"))
})

test("closing a background tab keeps the front", () => {
  expect(closeTab(list("a", "a", "b", "c"), "c", home)).toEqual(list("a", "a", "b"))
})

test("closing the last tab leaves a front-page tab", () => {
  const after = closeTab(list("a", "a"), "a", home)
  expect(after).toEqual({ tabs: [tab("home", "/")], front: "home" })
})

test("close others keeps one tab, in front", () => {
  expect(closeOthers(list("a", "a", "b", "c"), "b")).toEqual(list("b", "b"))
  const before = list("a", "a")
  expect(closeOthers(before, "zz")).toBe(before)
})

test("a duplicate sits right after its source, in front, with no history of its own", () => {
  const source = { ...tab("a"), key: "entry" }
  const after = duplicateTab({ tabs: [source, tab("b")], front: "b" }, "a", "n")
  expect(ids(after)).toEqual(["a", "n", "b"])
  expect(after.front).toBe("n")
  expect(after.tabs[1]).toEqual({ id: "n", href: "/a.olai", title: "a" })
})

test("reorder moves one tab and ignores indices out of range", () => {
  const before = list("a", "a", "b", "c")
  expect(ids(reorderTabs(before, 0, 2))).toEqual(["b", "c", "a"])
  expect(ids(reorderTabs(before, 2, 0))).toEqual(["c", "a", "b"])
  expect(reorderTabs(before, 0, 3)).toBe(before)
  expect(reorderTabs(before, -1, 0)).toBe(before)
  expect(reorderTabs(before, 1, 1)).toBe(before)
})

test("stepping the front wraps at both ends", () => {
  expect(stepFront(list("c", "a", "b", "c"), 1).front).toBe("a")
  expect(stepFront(list("a", "a", "b", "c"), -1).front).toBe("c")
})

test("updating a tab that did not change answers the same list", () => {
  const before = list("a", "a", "b")
  expect(updateTab(before, "a", { href: "/a.olai" })).toBe(before)
  expect(updateTab(before, "a", { href: "/x" }).tabs[0]?.href).toBe("/x")
})

test("a new id is one past the largest", () => {
  expect(nextId(undefined)).toBe("t1")
  expect(nextId({ tabs: [tab("t3"), tab("t10"), tab("odd")], front: "t3" })).toBe("t11")
})
