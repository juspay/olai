import { expect, test } from "bun:test"

import { createPreviews, sizeText } from "./previews.ts"

test("bytes are whole, and stay bytes to the last one before a kilobyte", () => {
  expect(sizeText(0)).toBe("0 B")
  expect(sizeText(5)).toBe("5 B")
  expect(sizeText(940)).toBe("940 B")
  expect(sizeText(1023)).toBe("1023 B")
})

test("the unit turns over at 1024, matching the cap's own arithmetic", () => {
  expect(sizeText(1024)).toBe("1 KB")
  expect(sizeText(1536)).toBe("1.5 KB")
  expect(sizeText(1024 * 1024)).toBe("1 MB")
  expect(sizeText(50 * 1024 * 1024)).toBe("50 MB")
})

test("one decimal below ten, none above it — three digits at most", () => {
  expect(sizeText(2662)).toBe("2.6 KB")
  expect(sizeText(10 * 1024)).toBe("10 KB")
  expect(sizeText(11.6 * 1024)).toBe("12 KB")
  expect(sizeText(3.4 * 1024 * 1024)).toBe("3.4 MB")
})

test("a size no attachment can reach still reads as a size", () => {
  expect(sizeText(2 * 1024 * 1024 * 1024)).toBe("2 GB")
})


test("attachment previews with the same name remain isolated by upload lifetime", () => {
  const previews = createPreviews()
  const first = new Blob(["first"])
  const other = new Blob(["other"])
  previews.remember("notes.txt", first, "one")
  previews.remember("notes.txt", other, "two")
  expect(previews.previewOf("notes.txt", "one")).toBe(first)
  expect(previews.previewOf("notes.txt", "two")).toBe(other)
  expect(previews.previewOf("notes.txt", "restarted")).toBeUndefined()
})
