/**
 * The scale, as a table with properties nobody can eyeball: every value a whole
 * multiple of the step, the two densities the same design at two sizes, and
 * the generated CSS saying what the table says.
 *
 * The browser test in `packages/tests` is the other half — it holds a rendered
 * page to these same numbers. This one holds the numbers to themselves, which
 * is what makes "on the scale" mean something before a browser is involved.
 */

import { expect, test } from "bun:test"

import {
  BLOCK_CLASS,
  BORDER_PX,
  COMPACT_CLASS,
  DENSITIES,
  HEAD_BORDER_PX,
  LEADING,
  PAD,
  property,
  RELATIVE,
  scaleCss,
  SPACE,
  STEP_REM,
  TYPE,
  UNDER_TITLE,
  WEIGHT,
} from "./scale.ts"

const css = scaleCss()

/** Every length in the table, whichever density it belongs to. */
const lengths = [
  ...Object.entries(TYPE),
  ...Object.entries(UNDER_TITLE),
  ...DENSITIES.flatMap((density) => [
    ...Object.entries(SPACE[density]),
    ...Object.entries(PAD[density]),
  ]),
]

// The property that makes the scale a scale rather than a list of numbers
// somebody liked. Stated in the module's own comment, and true here or the
// comment is a lie.
test("every value is a whole multiple of the step", () => {
  const off = lengths
    .filter(([, value]) => !Number.isInteger(value / STEP_REM))
    .map(([name, value]) => `${name}: ${value}rem is ${value / STEP_REM} steps`)
  expect(off).toEqual([])
})

// The ceiling is the row title: three levels, one size, on the grid. A
// heading that out-shouts the line it hangs from is the bug this exists
// to prevent; splitting h1 from h2 here would be a second scale inside
// a note nobody opened to read as a document.
test("the compact ceiling is one size, at the row title", () => {
  expect(UNDER_TITLE.h1).toBe(1)
  expect(UNDER_TITLE.h2).toBe(UNDER_TITLE.h1)
  expect(UNDER_TITLE.h3).toBe(UNDER_TITLE.h1)
})

// A ceiling that is not below what it clamps is not a ceiling.
test("the compact sizes are smaller than the ones they replace", () => {
  for (const level of Object.keys(UNDER_TITLE) as (keyof typeof UNDER_TITLE)[]) {
    expect(UNDER_TITLE[level]).toBeLessThan(TYPE[level])
  }
  // And still at or above the body's own size, or the heading would be a
  // caption.
  for (const size of Object.values(UNDER_TITLE)) expect(size).toBeGreaterThanOrEqual(1)
})

test("the heading scale never rises as the level goes down", () => {
  const sizes = [TYPE.h1, TYPE.h2, TYPE.h3, TYPE.h4, TYPE.h5, TYPE.h6]
  for (let at = 1; at < sizes.length; at++) {
    expect(sizes[at]!).toBeLessThanOrEqual(sizes[at - 1]!)
  }
})

// The two densities are ONE design read twice. A key in one and not the other
// would be a rule that silently falls back to whatever it inherits.
test("both densities answer exactly the same keys", () => {
  expect(Object.keys(SPACE.compact)).toEqual(Object.keys(SPACE.reading))
  expect(Object.keys(PAD.compact)).toEqual(Object.keys(PAD.reading))
})

// "One notch denser" is the claim, and this is it: nowhere is compact roomier
// than reading, and it is genuinely tighter where the air actually is.
test("compact is never roomier than reading, and is tighter where it counts", () => {
  for (const key of Object.keys(SPACE.reading) as (keyof typeof SPACE.reading)[]) {
    expect(SPACE.compact[key]).toBeLessThanOrEqual(SPACE.reading[key])
  }
  for (const key of Object.keys(PAD.reading) as (keyof typeof PAD.reading)[]) {
    expect(PAD.compact[key]).toBeLessThanOrEqual(PAD.reading[key])
  }
  expect(SPACE.compact.block).toBeLessThan(SPACE.reading.block)
  expect(SPACE.compact.headTopMajor).toBeLessThan(SPACE.reading.headTopMajor)
})

// The gap above a heading belongs to the section that ENDED, so it has to beat
// the gap the same heading leaves below itself — in both densities, or one of
// them has headings floating between two bodies of text.
test("a heading always takes more space above than below", () => {
  for (const density of DENSITIES) {
    expect(SPACE[density].headTopMajor).toBeGreaterThan(SPACE[density].headBottomMajor)
    expect(SPACE[density].headTopMinor).toBeGreaterThan(SPACE[density].headBottomMinor)
  }
})

// A list item's own gap has to be smaller than the block gap, or a tight list
// is indistinguishable from a loose one — and larger than nothing, which is
// what it was when a five-line item ran into the next.
test("a tight list separates its items, by less than a block", () => {
  for (const density of DENSITIES) {
    expect(SPACE[density].item).toBeGreaterThan(0)
    expect(SPACE[density].item).toBeLessThan(SPACE[density].block)
  }
})

test("the generated CSS declares every value the table holds", () => {
  for (const [level, size] of Object.entries(TYPE)) {
    expect(css).toContain(`${property(level)}: ${size}rem;`)
  }
  for (const [name, factor] of Object.entries(RELATIVE)) {
    expect(css).toContain(`${property(`of-${name}`)}: ${factor};`)
  }
  for (const [name, ratio] of Object.entries(LEADING)) {
    expect(css).toContain(`${property(`leading-${name}`)}: ${ratio};`)
  }
  for (const [name, weight] of Object.entries(WEIGHT)) {
    expect(css).toContain(`${property(`weight-${name}`)}: ${weight};`)
  }
  for (const [name, width] of Object.entries(BORDER_PX)) {
    expect(css).toContain(`${property(`border-${name}`)}: ${width}px;`)
  }
})

// Each density's block declares its own spacing, padding and heading rule —
// which is what lets one class re-answer the whole design.
test("each density's block declares its whole half of the table", () => {
  const blocks = {
    reading: css.slice(css.indexOf(`.${BLOCK_CLASS} {`), css.indexOf(`.${COMPACT_CLASS} {`)),
    compact: css.slice(css.indexOf(`.${COMPACT_CLASS} {`)),
  }
  for (const density of DENSITIES) {
    const block = blocks[density]
    for (const [name, size] of Object.entries(SPACE[density])) {
      expect(block).toContain(`${property(`space-${name}`)}: ${size}rem;`)
    }
    for (const [name, size] of Object.entries(PAD[density])) {
      expect(block).toContain(`${property(`pad-${name}`)}: ${size}rem;`)
    }
    expect(block).toContain(`${property("border-head")}: ${HEAD_BORDER_PX[density]}px;`)
  }
})

// The clamp is a REDEFINITION of the properties the heading rules already
// read, which is what keeps it out of a specificity race with them.
test("the compact block re-answers the ceiling and nothing below it", () => {
  const block = css.slice(css.indexOf(`.${COMPACT_CLASS} {`))
  for (const [level, size] of Object.entries(UNDER_TITLE)) {
    expect(block).toContain(`${property(level)}: ${size}rem;`)
  }
  // Not h4 down: those already sit at or below the body's size, and a copy of
  // them here would be a second table to keep in step for no effect.
  for (const level of ["h4", "h5", "h6"]) {
    expect(block).not.toContain(property(level) + ":")
  }
})

test("both blocks are keyed on the classes the components actually add", () => {
  expect(css).toContain(`.${BLOCK_CLASS} {`)
  expect(css).toContain(`.${COMPACT_CLASS} {`)
})

// Only the reading context draws a line under its major headings; a rule
// inside a tree row is furniture drawn on top of furniture.
test("the heading rule belongs to the page and not to the furniture", () => {
  expect(HEAD_BORDER_PX.reading).toBe(BORDER_PX.rule)
  expect(HEAD_BORDER_PX.compact).toBe(BORDER_PX.none)
  expect(PAD.compact.headRule).toBe(0)
})
