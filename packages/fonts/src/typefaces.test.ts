import { expect, test } from "bun:test"

import {
  FONT_GROUPS,
  FONT_NAMES,
  FONT_TOKENS,
  TYPEFACES,
  typefaceNamed,
} from "./typefaces.ts"

// That the default names a row is held by `DEFAULT_TYPEFACE`'s own throw, at
// import, before any assertion here could run — so asking `typefaceNamed` for
// it and comparing the answer to the value defined as that answer was a
// question with one possible outcome.
test("every typeface has a unique name", () => {
  expect(new Set(FONT_NAMES).size).toBe(FONT_NAMES.length)
})

test("a name no row offers is undefined, not a guess", () => {
  expect(typefaceNamed("comic-sans")).toBeUndefined()
  expect(typefaceNamed("")).toBeUndefined()
})

test("every typeface answers the three tokens", () => {
  for (const face of TYPEFACES) {
    for (const token of FONT_TOKENS) {
      expect(face[token].length).toBeGreaterThan(0)
    }
  }
})

test("the groups partition the table, in table order inside each", () => {
  const grouped = FONT_GROUPS.flatMap((group) => group.faces.map((f) => f.name))
  expect([...grouped]).toEqual([...FONT_NAMES])
})
