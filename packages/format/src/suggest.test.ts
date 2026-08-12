/**
 * The typo rule, on its own.
 *
 * It has two readers — the validator's `unknown-target` on load, and the ops
 * layer's refusal of the same target at the plan — and what they must agree
 * about is exactly what is asserted here: how far is close enough. A test
 * through either reader would pin the sentence rather than the budget.
 */

import { describe, expect, test } from "bun:test"

import { didYouMean, nearestId } from "./suggest.ts"

describe("nearestId", () => {
  test("a near miss is the candidate", () => {
    expect(nearestId("kitchn", ["kitchen", "sink"])).toBe("kitchen")
  })

  test("a different word is not a suggestion", () => {
    // `zzz` against `kitchen` is a distance of seven, and offering it would
    // train a reader to ignore the clause.
    expect(nearestId("zzz", ["kitchen"])).toBeNull()
  })

  /** The budget is a third of the id's length and never less than two, so a
   *  SHORT id still gets a suggestion — one or two characters out of four is
   *  the misspelling people actually make. */
  test("a short id keeps a floor of two", () => {
    expect(nearestId("odr", ["order"])).toBe("order")
    expect(nearestId("od", ["order"])).toBeNull()
  })

  test("nothing to suggest from is null rather than a throw", () => {
    expect(nearestId("anything", [])).toBeNull()
  })

  /** Ties go to the first candidate offered, so two readings of one set say the
   *  same thing rather than whichever the iteration order handed over. */
  test("a tie keeps the first candidate", () => {
    expect(nearestId("ab", ["ax", "ay"])).toBe("ax")
  })
})

test("didYouMean is the clause, or nothing at all", () => {
  expect(didYouMean("kitchn", ["kitchen"])).toBe(" — did you mean `kitchen`?")
  expect(didYouMean("zzz", ["kitchen"])).toBe("")
})
