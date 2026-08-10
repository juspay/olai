import { expect, test } from "bun:test"

import { firstLine } from "./preview.ts"

test("the first line is the first line with anything on it", () => {
  expect(firstLine("\n\n  Brushed brass.\nAnd more.\n")).toBe("Brushed brass.")
})

// A document nearly always opens with its title as a heading, and the hashes
// are markup rather than part of the name.
test("a leading heading is named without its marks", () => {
  expect(firstLine("# Finishes\n\nDoors: matte.")).toBe("Finishes")
  expect(firstLine("### Deep ###")).toBe("Deep")
})

// Only the heading marks. Emphasis, links and code spans stay as written: a
// preview that started interpreting them would be a second, worse renderer.
test("nothing else is interpreted", () => {
  expect(firstLine("- **walnut**, or `birch`")).toBe("- **walnut**, or `birch`")
  expect(firstLine("#tag first")).toBe("#tag first")
})

test("an empty document previews as nothing", () => {
  expect(firstLine("")).toBe("")
  expect(firstLine("\n \n")).toBe("")
})
