import type { DocumentEntry } from "../../wire.ts"
import { expect, test } from "bun:test"

import { isServed } from "./ready.ts"

const entry = (
  fields: Pick<DocumentEntry, "text" | "refused">,
): DocumentEntry => ({ rev: 1, ...fields })

test("a body is served, a refusal is not, and a wait is neither", () => {
  expect(isServed(undefined)).toBe(false)
  expect(isServed(entry({ text: "# Finishes\n", refused: false }))).toBe(true)
  expect(isServed(entry({ text: "", refused: false }))).toBe(true)
  expect(isServed(entry({ text: null, refused: false }))).toBe(false)
  expect(isServed(entry({ text: null, refused: true }))).toBe(false)
  expect(isServed(entry({ text: "", refused: true }))).toBe(false)
})
