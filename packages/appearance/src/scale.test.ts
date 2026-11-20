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

const lengths = [
  ...Object.entries(TYPE),
  ...Object.entries(UNDER_TITLE),
  ...DENSITIES.flatMap((density) => [
    ...Object.entries(SPACE[density]),
    ...Object.entries(PAD[density]),
  ]),
]

test("every value is a whole multiple of the step", () => {
  const off = lengths
    .filter(([, value]) => !Number.isInteger(value / STEP_REM))
    .map(([name, value]) => `${name}: ${value}rem is ${value / STEP_REM} steps`)
  expect(off).toEqual([])
})

test("the compact ceiling is one size, at the row title", () => {
  expect(UNDER_TITLE.h1).toBe(1)
  expect(UNDER_TITLE.h2).toBe(UNDER_TITLE.h1)
  expect(UNDER_TITLE.h3).toBe(UNDER_TITLE.h1)
})

test("the compact sizes are smaller than the ones they replace", () => {
  for (const level of Object.keys(UNDER_TITLE) as (keyof typeof UNDER_TITLE)[]) {
    expect(UNDER_TITLE[level]).toBeLessThan(TYPE[level])
  }
  for (const size of Object.values(UNDER_TITLE)) expect(size).toBeGreaterThanOrEqual(1)
})

test("the heading scale never rises as the level goes down", () => {
  const sizes = [TYPE.h1, TYPE.h2, TYPE.h3, TYPE.h4, TYPE.h5, TYPE.h6]
  for (let at = 1; at < sizes.length; at++) {
    expect(sizes[at]!).toBeLessThanOrEqual(sizes[at - 1]!)
  }
})

test("both densities answer exactly the same keys", () => {
  expect(Object.keys(SPACE.compact)).toEqual(Object.keys(SPACE.reading))
  expect(Object.keys(PAD.compact)).toEqual(Object.keys(PAD.reading))
})

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

test("a heading always takes more space above than below", () => {
  for (const density of DENSITIES) {
    expect(SPACE[density].headTopMajor).toBeGreaterThan(SPACE[density].headBottomMajor)
    expect(SPACE[density].headTopMinor).toBeGreaterThan(SPACE[density].headBottomMinor)
  }
})

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

test("the compact block re-answers the ceiling and nothing below it", () => {
  const block = css.slice(css.indexOf(`.${COMPACT_CLASS} {`))
  for (const [level, size] of Object.entries(UNDER_TITLE)) {
    expect(block).toContain(`${property(level)}: ${size}rem;`)
  }
  for (const level of ["h4", "h5", "h6"]) {
    expect(block).not.toContain(property(level) + ":")
  }
})

test("both blocks are keyed on the classes the components actually add", () => {
  expect(css).toContain(`.${BLOCK_CLASS} {`)
  expect(css).toContain(`.${COMPACT_CLASS} {`)
})

test("the heading rule belongs to the page and not to the furniture", () => {
  expect(HEAD_BORDER_PX.reading).toBe(BORDER_PX.rule)
  expect(HEAD_BORDER_PX.compact).toBe(BORDER_PX.none)
  expect(PAD.compact.headRule).toBe(0)
})
