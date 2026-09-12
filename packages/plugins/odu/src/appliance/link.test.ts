import { expect, test } from "bun:test"

import { speaksCompatible } from "./link.ts"

test("the same major is speakable", () => {
  expect(speaksCompatible("1.3", "1.3")).toBe(true)
  expect(speaksCompatible("1.3", "1.4")).toBe(true)
  expect(speaksCompatible("1.3", "1.0")).toBe(true)
})

test("a different major is skew", () => {
  expect(speaksCompatible("1.3", "2.0")).toBe(false)
  expect(speaksCompatible("1.3", "")).toBe(false)
})
