import { expect, test } from "bun:test"

import { clamp } from "./prefs.ts"

test("clamp holds a value inside its bounds", () => {
  expect(clamp(10, 0, 20)).toBe(10)
  expect(clamp(-5, 0, 20)).toBe(0)
  expect(clamp(99, 0, 20)).toBe(20)
  expect(clamp(0, 0, 20)).toBe(0)
  expect(clamp(20, 0, 20)).toBe(20)
})
