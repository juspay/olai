/**
 * The scale, as a table with a property nobody can eyeball: every value is a
 * whole multiple of the step, and the generated CSS says what the table says.
 *
 * The browser test in `packages/tests` is the other half — it holds a rendered
 * page to these same numbers. This one holds the numbers to themselves, which
 * is what makes "on the scale" mean something before a browser is involved.
 */

import { expect, test } from "bun:test"

import {
  BLOCK_CLASS,
  BORDER_PX,
  LEADING,
  PAD,
  property,
  RELATIVE,
  scaleCss,
  SPACE,
  STEP_REM,
  TYPE,
  UNDER_TITLE,
  UNDER_TITLE_CLASS,
} from "./scale.ts"

const css = scaleCss()

// The one property that makes the scale a scale rather than a list of numbers
// somebody liked. Stated in the module's own comment, and true here or the
// comment is a lie.
test("every size and space is a whole multiple of the step", () => {
  const off: string[] = []
  for (const [name, value] of [...Object.entries(TYPE), ...Object.entries(SPACE), ...Object.entries(PAD)]) {
    const steps = value / STEP_REM
    if (!Number.isInteger(steps)) off.push(`${name}: ${value}rem is ${steps} steps`)
  }
  expect(off).toEqual([])
})

// The one deliberate exception, named as such in the module. A half-step that
// nobody wrote down would be the beginning of a second grid.
test("the under-title ceiling spends exactly one half-step, and says so", () => {
  const halves = Object.entries(UNDER_TITLE).filter(
    ([, value]) => !Number.isInteger(value / STEP_REM),
  )
  expect(halves.map(([, value]) => value)).toEqual([1.0625, 1.0625])
  // Both spellings are the same number, so it is one decision and not two.
  expect(UNDER_TITLE.h1).toBe(UNDER_TITLE.h2)
})

// A ceiling that is not below what it clamps is not a ceiling.
test("the under-title sizes are smaller than the ones they replace", () => {
  for (const level of Object.keys(UNDER_TITLE) as (keyof typeof UNDER_TITLE)[]) {
    expect(UNDER_TITLE[level]).toBeLessThanOrEqual(TYPE[level])
  }
  // And still above the body's own size, or the heading would be a caption.
  for (const size of Object.values(UNDER_TITLE)) expect(size).toBeGreaterThanOrEqual(1)
})

test("the heading scale never rises as the level goes down", () => {
  const sizes = [TYPE.h1, TYPE.h2, TYPE.h3, TYPE.h4, TYPE.h5, TYPE.h6]
  for (let at = 1; at < sizes.length; at++) {
    expect(sizes[at]!).toBeLessThanOrEqual(sizes[at - 1]!)
  }
})

test("the generated CSS declares every value the table holds", () => {
  for (const [level, size] of Object.entries(TYPE)) {
    expect(css).toContain(`${property(level)}: ${size}rem;`)
  }
  for (const [name, size] of Object.entries(SPACE)) {
    expect(css).toContain(`${property(`space-${name}`)}: ${size}rem;`)
  }
  for (const [name, size] of Object.entries(PAD)) {
    expect(css).toContain(`${property(`pad-${name}`)}: ${size}rem;`)
  }
  for (const [name, factor] of Object.entries(RELATIVE)) {
    expect(css).toContain(`${property(`of-${name}`)}: ${factor};`)
  }
  for (const [name, ratio] of Object.entries(LEADING)) {
    expect(css).toContain(`${property(`leading-${name}`)}: ${ratio};`)
  }
  for (const [name, width] of Object.entries(BORDER_PX)) {
    expect(css).toContain(`${property(`border-${name}`)}: ${width}px;`)
  }
})

// The clamp is a REDEFINITION of the properties the heading rules already
// read, which is what keeps it out of a specificity race with them.
test("the under-title block re-answers the ceiling and nothing else", () => {
  const block = css.slice(css.indexOf(`.${UNDER_TITLE_CLASS}`))
  for (const [level, size] of Object.entries(UNDER_TITLE)) {
    expect(block).toContain(`${property(level)}: ${size}rem;`)
  }
  expect(block).toContain(`${property("heading-top")}: ${SPACE.note}rem;`)
  // Not h4 down: those already sit at or below the body's size, and a copy of
  // them here would be a second table to keep in step for no effect.
  for (const level of ["h4", "h5", "h6"]) {
    expect(block).not.toContain(property(level) + ":")
  }
})

test("both blocks are keyed on the classes the components actually add", () => {
  expect(css).toContain(`.${BLOCK_CLASS} {`)
  expect(css).toContain(`.${UNDER_TITLE_CLASS} {`)
})
