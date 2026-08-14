import { expect, test } from "bun:test"

import {
  DEFAULT_FONT,
  DEFAULT_TYPEFACE,
  FONT_GROUPS,
  FONT_NAMES,
  FONT_TOKENS,
  TYPEFACES,
  typefaceNamed,
} from "./typefaces.ts"

test("every typeface has a unique name, and the default is one of them", () => {
  expect(new Set(FONT_NAMES).size).toBe(FONT_NAMES.length)
  expect(typefaceNamed(DEFAULT_FONT)).toBe(DEFAULT_TYPEFACE)
  expect(DEFAULT_TYPEFACE.name).toBe(DEFAULT_FONT)
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
