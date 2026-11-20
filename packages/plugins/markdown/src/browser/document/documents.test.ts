import { expect, test } from "bun:test"

import { isServed } from "./ready.ts"

test("a body is served, a refusal is not", () => {
  expect(isServed(undefined)).toBe(false)
  expect(isServed({ rev: 1, state: "served", text: "# Finishes\n" })).toBe(true)
  expect(isServed({ rev: 1, state: "served", text: "" })).toBe(true)
  expect(isServed({ rev: 1, state: "refused" })).toBe(false)
})
