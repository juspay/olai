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

// The closing run markdown allows, and the one place it must NOT come off: a
// heading that ends in a hash with no space before it is a heading about C#.
test("the closing hashes come off, and a hash that is a word does not", () => {
  expect(plainLine("## Install ##")).toBe("Install")
  expect(plainLine("## C#")).toBe("C#")
  expect(plainLine("# Notes ##\n\nbody")).toBe("Notes")
})

test("a long run of spaces that does not close a heading is answered at once", () => {
  // The reason this counts rather than matching: `replace(/\s+#+$/, "")` is
  // quadratic on a line of many spaces that do not end in hashes — the
  // unanchored `\s+` restarts at every position. A tenth of a second here
  // would be a finding.
  const started = performance.now()
  const line = `x${" ".repeat(50_000)}y`
  expect(plainLine(line)).toBe(line)
  expect(performance.now() - started).toBeLessThan(100)
}, 500)

test("an empty note previews as nothing", () => {
  expect(plainLine("")).toBe("")
  expect(plainLine("\n \n")).toBe("")
})
