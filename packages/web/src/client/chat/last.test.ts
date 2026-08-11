import { expect, test } from "bun:test"

import { previewText } from "./last.ts"

test("preview leaves a short line alone", () => {
  expect(previewText("hello")).toBe("hello")
})

test("preview flattens whitespace", () => {
  expect(previewText("a\n\nb  c")).toBe("a b c")
})

test("preview clamps a long line with an ellipsis", () => {
  const long = "x".repeat(100)
  const out = previewText(long, 20)
  expect(out.endsWith("…")).toBe(true)
  expect(out.length).toBe(20)
})
