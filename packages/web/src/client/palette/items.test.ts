import { expect, test } from "bun:test"

import { askQuery, filterItems, SHELL_ITEMS } from "./items.ts"

test("empty query returns every shell item", () => {
  expect(filterItems("").length).toBe(SHELL_ITEMS.length)
})

test("filter matches label and search haystack", () => {
  expect(filterItems("today").map((i) => i.id)).toEqual(["nav-today"])
  expect(filterItems("sidebar").map((i) => i.id)).toEqual(["panel-sidebar"])
  expect(filterItems("agent").map((i) => i.id)).toEqual(["panel-chat"])
})

test("askQuery strips the > prefix", () => {
  expect(askQuery("> mark kitchen done")).toBe("mark kitchen done")
  expect(askQuery("  >  hello")).toBe("hello")
  expect(askQuery(">")).toBe("")
  expect(askQuery("toggle")).toBeNull()
  expect(askQuery("not > this")).toBeNull()
})
