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

// The closing run markdown allows, and the one place it must NOT come off: a
// heading that ends in a hash with no space before it is a heading about C#.
test("the closing hashes come off, and a hash that is a word does not", () => {
  expect(plainLine("## Install ##")).toBe("Install")
  expect(plainLine("## C#")).toBe("C#")
  expect(plainLine("# Notes ##\n\nbody")).toBe("Notes")
})

test("a non-breaking space is not the gap a closing run needs", () => {
  // Chosen, not an accident of the scan: CommonMark wants U+0020 or tab before
  // the closing hashes, and headingText already spelled those two. The regex
  // this replaces treated NBSP (and the rest of `\s`) as that gap, so this
  // line used to preview as `Foo`.
  expect(plainLine("# Foo\u00a0##")).toBe("Foo\u00a0##")
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

// measuredAt: a click speaks the clamped line's characters; the caret is
// answered in the note's. The line is the note's first non-blank one, with
// the marks stripped, so the map skips the marks and otherwise goes home.
test("a measured word lands where the word came from", () => {
  const desc = "Two ways to go:\n\n- **walnut** — six week lead time"
  // "Two ways to go:" spells itself — no marks on the first line.
  expect(measuredAt(desc, 0)).toBe(0)
  expect(measuredAt(desc, 4)).toBe(4)
  expect(measuredAt(desc, 15)).toBe(15)
  // Past the line's end is the line's end, not the next line's start: the
  // caret belongs to the words the finger saw, and a click on the clamp with
  // the note's later lines folded away must not land inside them.
  expect(measuredAt(desc, 200)).toBe(15)
})

test("leading blank lines and spaces stay where the note keeps them", () => {
  const desc = "\n\n  Two ways to go:\n\n- more\n"
  expect(measuredAt(desc, 0)).toBe("\n\n  ".length)
})

test("the marks a bold word carries are skipped, both sides of it", () => {
  const desc = "*tap* the **valve** twice"
  // view: "tap the valve twice" — a leading mark is never the caret's land.
  expect(measuredAt(desc, 0)).toBe(1)
  // Between the word and the space after it is where the closing mark lives;
  // the caret goes past it, which is where the finger saw the gap.
  expect(measuredAt(desc, 3)).toBe(5)
  // "valve" spans view 8..12: the last letter's name in the source.
  expect(measuredAt(desc, 12)).toBe(16)
  // Past the drawn words is the end of the note, whatever the clamp showed.
  expect(measuredAt(desc, 50)).toBe(25)
})

test("a list's bullet mark is not a character of the note-tap", () => {
  const desc = "- walnut — six week lead time"
  expect(measuredAt(desc, 0)).toBe(2)
})

test("an all-blank note has only the start", () => {
  expect(measuredAt("\n \n", 3)).toBe(0)
})
