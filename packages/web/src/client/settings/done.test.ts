import { expect, test } from "bun:test"

import { parseDoneHidden } from "./done.ts"

test("only the word this file writes is a pick; everything else is the default", () => {
  expect(parseDoneHidden("true")).toBe(true)
  expect(parseDoneHidden("false")).toBe(false)
  // A browser that has never been asked, and a value nothing here ever wrote —
  // an older olai's spelling, something typed into a console. Neither is a
  // reader saying they want finished work hidden.
  expect(parseDoneHidden(null)).toBe(false)
  expect(parseDoneHidden("1")).toBe(false)
  expect(parseDoneHidden("hidden")).toBe(false)
})
