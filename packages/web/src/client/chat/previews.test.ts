/**
 * How big a file is, in the words a chip has room for.
 *
 * The rounding is the whole of it, and it is the kind that looks obviously
 * right until a number lands on a boundary: a 940-byte file that reads
 * `0.9 KB` has been rounded into a lie about its own unit, and a 1023-byte one
 * that reads `1 KB` is a size somebody will compare against the 50 MB cap and
 * find does not add up.
 */

import { expect, test } from "bun:test"

import { sizeText } from "./previews.ts"

test("bytes are whole, and stay bytes to the last one before a kilobyte", () => {
  expect(sizeText(0)).toBe("0 B")
  expect(sizeText(5)).toBe("5 B")
  expect(sizeText(940)).toBe("940 B")
  expect(sizeText(1023)).toBe("1023 B")
})

test("the unit turns over at 1024, matching the cap's own arithmetic", () => {
  // MAX_ATTACHMENT_BYTES is 50 * 1024 * 1024, so a chip that counted in
  // thousands would disagree with the refusal that turns the file away.
  expect(sizeText(1024)).toBe("1 KB")
  expect(sizeText(1536)).toBe("1.5 KB")
  expect(sizeText(1024 * 1024)).toBe("1 MB")
  expect(sizeText(50 * 1024 * 1024)).toBe("50 MB")
})

test("one decimal below ten, none above it — three digits at most", () => {
  expect(sizeText(2662)).toBe("2.6 KB")
  expect(sizeText(10 * 1024)).toBe("10 KB")
  // Rounded rather than truncated once the decimal is gone.
  expect(sizeText(11.6 * 1024)).toBe("12 KB")
  expect(sizeText(3.4 * 1024 * 1024)).toBe("3.4 MB")
})

test("a size no attachment can reach still reads as a size", () => {
  // The cap makes this unreachable through the composer, and the function is
  // still asked rather than left to produce `1024 MB`.
  expect(sizeText(2 * 1024 * 1024 * 1024)).toBe("2 GB")
})
