import { expect, test } from "bun:test"

import { DEFAULT_DENSITY, type Density, showsPreview, startsOpen } from "./density.ts"

// The two readings of one table, kept honest against each other: the three
// answers are a spectrum, and exactly one of them draws the clamped preview
// while exactly one starts a row open. A fourth density, or a second `true` in
// either column, is a face nothing on screen distinguishes.
const ALL: ReadonlyArray<Density> = ["compact", "cozy", "open"]

test("the clamped preview is cozy's alone", () => {
  expect(ALL.filter(showsPreview)).toEqual(["cozy"])
})

test("starting open is open's alone", () => {
  expect(ALL.filter(startsOpen)).toEqual(["open"])
})

test("compact is a row's title and nothing under it", () => {
  expect(showsPreview(DEFAULT_DENSITY)).toBe(false)
  expect(startsOpen(DEFAULT_DENSITY)).toBe(false)
})
