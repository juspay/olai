import { expect, test } from "bun:test"

import { plainLine } from "./preview.ts"

test("the first line is the first line with anything on it", () => {
  expect(plainLine("\n\n  Two ways to go:\n\n- more\n")).toBe("Two ways to go:")
})

test("emphasis and code marks are words, not source", () => {
  expect(plainLine("Call the utility line **before** digging.")).toBe(
    "Call the utility line before digging.",
  )
  expect(plainLine("Pick `walnut` or *birch*.")).toBe("Pick walnut or birch.")
})

test("a link keeps its label", () => {
  expect(plainLine("See [the plan](./plan.md) first.")).toBe("See the plan first.")
})

test("a list item is the item without its mark", () => {
  expect(plainLine("- **walnut** — six week lead time")).toBe(
    "walnut — six week lead time",
  )
  expect(plainLine("1. first thing")).toBe("first thing")
})

test("a leading heading is named without its marks", () => {
  expect(plainLine("# Notes\n\nbody")).toBe("Notes")
})

test("an empty note previews as nothing", () => {
  expect(plainLine("")).toBe("")
  expect(plainLine("\n \n")).toBe("")
})
