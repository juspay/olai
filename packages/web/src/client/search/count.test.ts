/**
 * What a shortlist says about the answer it could not draw all of, over every
 * shape two numbers can be in.
 *
 * A sentence rather than a layout, which is why this is a `bun test` and not a
 * scenario: what a browser adds is that the numbers are the ANSWER's own and
 * that the line is drawn where a reader looks, and both doors have a scenario
 * for that (`packages/tests/features/a_shortlist_says_its_total.feature`).
 * What is pinned HERE is the English — and, above all, the silence: a door that
 * drew everything it found says nothing, because "8 of 8" is a number somebody
 * has to read before they can ignore it (`../filter/count.ts` makes the same
 * ruling about a zero).
 */

import { expect, test } from "bun:test"

import { countLine } from "./count.ts"

// The line this file exists for: eight rows, and a reader who would otherwise
// believe the vault holds eight.
test("a capped answer says how many it drew and how many there were", () => {
  expect(countLine({ drawn: 8, total: 90 })).toBe("8 of 90 matches")
})

test("an answer that fits says nothing at all", () => {
  expect(countLine({ drawn: 3, total: 3 })).toBe(null)
})

// Nothing found is not a denominator either: the rows are absent and so is the
// line, and the door's own empty state is what says so.
test("nothing found says nothing", () => {
  expect(countLine({ drawn: 0, total: 0 })).toBe(null)
})

// A total BELOW what is drawn is arithmetic nobody can read, so the honest
// answer is the same silence rather than "9 of 2 matches". It cannot happen
// while both numbers ride on one answer (`./nodes.ts`), which is exactly why
// it is pinned: the day they come from two places, this is the line that must
// not start lying.
test("a total that cannot be right is not said out loud", () => {
  expect(countLine({ drawn: 9, total: 2 })).toBe(null)
})
