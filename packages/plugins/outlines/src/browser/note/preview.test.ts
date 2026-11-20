import { expect, test } from "bun:test"

import { measuredAt, plainLine } from "./preview.ts"

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

test("the closing hashes come off, and a hash that is a word does not", () => {
  expect(plainLine("## Install ##")).toBe("Install")
  expect(plainLine("## C#")).toBe("C#")
  expect(plainLine("# Notes ##\n\nbody")).toBe("Notes")
})

test("a non-breaking space is not the gap a closing run needs", () => {
  expect(plainLine("# Foo\u00a0##")).toBe("Foo\u00a0##")
})

test("a long run of spaces that does not close a heading is answered at once", () => {
  const started = performance.now()
  const line = `x${" ".repeat(50_000)}y`
  expect(plainLine(line)).toBe(line)
  expect(performance.now() - started).toBeLessThan(100)
}, 500)

test("an empty note previews as nothing", () => {
  expect(plainLine("")).toBe("")
  expect(plainLine("\n \n")).toBe("")
})

test("a measured word lands where the word came from", () => {
  const desc = "Two ways to go:\n\n- **walnut** — six week lead time"
  expect(measuredAt(desc, 0)).toBe(0)
  expect(measuredAt(desc, 4)).toBe(4)
  expect(measuredAt(desc, 15)).toBe(15)
  expect(measuredAt(desc, 200)).toBe(15)
})

test("leading blank lines and spaces stay where the note keeps them", () => {
  const desc = "\n\n  Two ways to go:\n\n- more\n"
  expect(measuredAt(desc, 0)).toBe("\n\n  ".length)
})

test("the marks a bold word carries are skipped, both sides of it", () => {
  const desc = "*tap* the **valve** twice"
  expect(measuredAt(desc, 0)).toBe(1)
  expect(measuredAt(desc, 3)).toBe(5)
  expect(measuredAt(desc, 12)).toBe(16)
  expect(measuredAt(desc, 50)).toBe(25)
})

test("a list's bullet mark is not a character of the note-tap", () => {
  const desc = "- walnut — six week lead time"
  expect(measuredAt(desc, 0)).toBe(2)
})

test("an all-blank note has only the start", () => {
  expect(measuredAt("\n \n", 3)).toBe(0)
})
