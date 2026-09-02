/**
 * The stacking plan's own two claims (`./layer.ts`).
 *
 * A layering bug is the hardest kind of thing to test in a browser: it is one
 * box being drawn behind another, in one viewport, in one state, and a
 * scenario that did not think to look at that pair passes happily. So what is
 * checked here is the TABLE — that its order is the order it claims, and that
 * its two bands cannot be confused for one another.
 *
 * The plan's third claim is about every OTHER file (nothing else may spell a
 * `z-*` utility), which makes it a sweep rather than a test, and the sweeps
 * live together in `./claims.test.ts`.
 */

import { expect, test } from "bun:test"

import { LAYER, WITHIN } from "./layer.ts"

/** The number a Tailwind `z-*` utility sets, in the two spellings this table
 *  uses: `z-30` and the arbitrary `z-[45]`. Reading it back out is what makes
 *  the claims below claims about the CSS rather than about field order. */
const rank = (utility: string): number => {
  const found = /^z-(?:\[(\d+)\]|(\d+))$/.exec(utility)
  if (found === null) throw new Error(`\`${utility}\` is not a z-index utility`)
  return Number(found[1] ?? found[2])
}

/** A band's numbers, in the order its fields are written. */
const band = (table: Record<string, string>): ReadonlyArray<number> =>
  Object.values(table).map(rank)

/** Strictly increasing: no two layers the same, and none out of order. */
const climbs = (numbers: ReadonlyArray<number>): boolean =>
  numbers.every((step, at) => at === 0 || step > numbers[at - 1]!)

test("the page's stack climbs in the order the table is written", () => {
  // The fields are the design, so the file reads top-to-bottom as
  // bottom-to-top of the page — a layer inserted in the wrong place, or a
  // number edited without moving the field, fails here rather than as a panel
  // behind a scrim in one viewport nobody screenshotted.
  expect(band(LAYER)).toSatisfy(climbs)
})

test("...and so does the band inside a box", () => {
  expect(band(WITHIN)).toSatisfy(climbs)
})

test("the two bands do not overlap, so the number says which question it answers", () => {
  // The whole reason `WITHIN` is single digits. The chat's session list used to
  // draw its dropdown at the command palette's own `z-50` while meaning
  // something sealed inside a panel three layers down; nothing was broken and
  // nothing could be read either.
  expect(Math.max(...band(WITHIN))).toBeLessThan(Math.min(...band(LAYER)))
})

// The third claim — that no other client file spells a `z-*` utility of its
// own — is a SWEEP rather than a test here, and it lives with the other sweeps
// in `./claims.test.ts`: that file already owns "claims this tree's docstrings
// make about where things are spelled", reads every source once, and strips
// comments properly so prose may discuss a utility while nothing else wears
// one.
