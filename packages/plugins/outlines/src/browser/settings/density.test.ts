import { expect, test } from "bun:test"

import { DEFAULT_DENSITY, type Density, showsPreview, startsOpen } from "./density.ts"

const ALL: ReadonlyArray<Density> = ["compact", "cozy", "open"]

test("the clamped preview is cozy's alone", () => {
  expect(ALL.filter(showsPreview)).toEqual(["cozy"])
})

test("starting open is open's alone", () => {
  expect(ALL.filter(startsOpen)).toEqual(["open"])
})

test("cozy is the default: the title and one line of the note", () => {
  expect(showsPreview(DEFAULT_DENSITY)).toBe(true)
  expect(startsOpen(DEFAULT_DENSITY)).toBe(false)
})
