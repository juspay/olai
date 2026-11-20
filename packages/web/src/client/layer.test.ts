import { expect, test } from "bun:test"

import { LAYER, WITHIN } from "./layer.ts"

const rank = (utility: string): number => {
  const found = /^z-(?:\[(\d+)\]|(\d+))$/.exec(utility)
  if (found === null) throw new Error(`\`${utility}\` is not a z-index utility`)
  return Number(found[1] ?? found[2])
}

const band = (table: Record<string, string>): ReadonlyArray<number> =>
  Object.values(table).map(rank)

const climbs = (numbers: ReadonlyArray<number>): boolean =>
  numbers.every((step, at) => at === 0 || step > numbers[at - 1]!)

test("the page's stack climbs in the order the table is written", () => {
  expect(band(LAYER)).toSatisfy(climbs)
})

test("...and so does the band inside a box", () => {
  expect(band(WITHIN)).toSatisfy(climbs)
})

test("the two bands do not overlap, so the number says which question it answers", () => {
  expect(Math.max(...band(WITHIN))).toBeLessThan(Math.min(...band(LAYER)))
})

test("the strip covers page headings and yields to chrome and the header", () => {
  expect(rank(LAYER.strip)).toBeGreaterThan(rank(LAYER.page))
  expect(rank(LAYER.strip)).toBeLessThan(rank(LAYER.chrome))
  expect(rank(LAYER.strip)).toBeLessThan(rank(LAYER.header))
})
