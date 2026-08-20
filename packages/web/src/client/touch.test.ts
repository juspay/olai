/**
 * The outline's own type, held to the ruling: a row is a line at the root
 * size, a note sits one step under it, and Large is the notch — not a second
 * one stacked on the title.
 */

import { expect, test } from "bun:test"

import { STEP_REM } from "./theme/scale.ts"
import { ROW_NOTE, ROW_TITLE, SECTION_TITLE } from "./touch.ts"

const remOf = (classes: string): number => {
  const found = classes.match(/text-\[(\d+(?:\.\d+)?)rem\]/)
  if (found?.[1] === undefined) {
    throw new Error(`no rem size in ${classes}`)
  }
  return Number(found[1])
}

test("a row title is the root size — Large is the notch, not a second one on top", () => {
  expect(remOf(ROW_TITLE)).toBe(1)
})

test("a note sits one step under the title", () => {
  expect(remOf(ROW_NOTE)).toBe(remOf(ROW_TITLE) - STEP_REM)
})

test("a section is one step above a row, not a heading", () => {
  expect(remOf(SECTION_TITLE)).toBe(remOf(ROW_TITLE) + STEP_REM)
})

test("the outline type sits on the markdown scale's step", () => {
  for (const size of [remOf(ROW_TITLE), remOf(ROW_NOTE), remOf(SECTION_TITLE)]) {
    expect(Number.isInteger(size / STEP_REM)).toBe(true)
  }
})
