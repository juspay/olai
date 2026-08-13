import { expect, test } from "bun:test"

import { askQuery, filterItems, nodeItem, SHELL_ITEMS } from "./items.ts"

test("empty query returns every shell item", () => {
  expect(filterItems("").length).toBe(SHELL_ITEMS.length)
  expect(SHELL_ITEMS.some((i) => i.id === "reset-widths")).toBe(true)
})

test("filter matches label and search haystack", () => {
  expect(filterItems("today").map((i) => i.id)).toEqual(["nav-today"])
  expect(filterItems("overdue").map((i) => i.id)).toEqual(["nav-agenda"])
  expect(filterItems("toggle sidebar").map((i) => i.id)).toEqual(["panel-sidebar"])
  expect(filterItems("agent").map((i) => i.id)).toEqual(["panel-chat"])
})

test("a search hit becomes a row that jumps to the node", () => {
  const item = nodeItem({
    id: "hinges",
    title: "pick the hinges",
    file: "house.jsonl",
    line: 6,
    path: ["kitchen remodel #home", "install the cabinets"],
    matched: "title",
  })
  expect(item.label).toBe("pick the hinges")
  expect(item.hint).toBe("install the cabinets")
  expect(item.action).toEqual({ kind: "route", route: { kind: "node", id: "hinges" } })
})

test("a semantic hit wears ≈, and a top-level one is placed by its file", () => {
  const meaning = nodeItem({
    id: "buy",
    title: "Buy groceries",
    file: "errands.jsonl",
    line: 1,
    path: [],
    matched: "meaning",
  })
  expect(meaning.hint).toBe("≈ errands.jsonl")
})

test("askQuery strips the > prefix", () => {
  expect(askQuery("> mark kitchen done")).toBe("mark kitchen done")
  expect(askQuery("  >  hello")).toBe("hello")
  expect(askQuery(">")).toBe("")
  expect(askQuery("toggle")).toBeNull()
  expect(askQuery("not > this")).toBeNull()
})
