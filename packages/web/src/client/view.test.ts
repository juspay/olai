/**
 * The one rule where "a reading starts fresh on a new page" and "a preference
 * belongs to the reader" have to be told apart.
 *
 * Values in, values out. What the reactive half does with it — a page nobody
 * has pressed the switch on moving when the preference moves, and a page
 * somebody has staying put — is four scenarios in
 * `packages/tests/features/preferences.feature`, because it takes two controls
 * and a page to ask.
 */

import { expect, test } from "bun:test"

import { doneHiddenIn } from "./view.ts"

test("a page nobody has pressed the switch on reads the preference", () => {
  expect(doneHiddenIn(undefined, false)).toBe(false)
  expect(doneHiddenIn(undefined, true)).toBe(true)
})

test("a page somebody has pressed it on is not the preference's to move", () => {
  expect(doneHiddenIn(false, true)).toBe(false)
  expect(doneHiddenIn(true, false)).toBe(true)
})

test("pressing the switch flips what is on screen", () => {
  // The bug this holds shut: negating the reading's own `undefined` is the same
  // answer again for a reader whose preference is already "hidden", so the
  // first press of the switch did nothing at all.
  expect(!doneHiddenIn(undefined, true)).toBe(false)
  expect(!doneHiddenIn(undefined, false)).toBe(true)
})
