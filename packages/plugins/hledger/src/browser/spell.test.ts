import { expect, test } from "bun:test"

import { type Amount } from "../journal/index.ts"
import { amountText, houseStyle } from "./spell.ts"

/** An amount with the style the file wrote it in. */
const written = (commodity: string, value: bigint, scale: number, sign: "leading" | "number", side: "prefix" | "suffix", spaced: boolean): Amount => ({
  commodity,
  value: { value, scale },
  style: { sign, side, spaced },
})

/** An amount this reader computed — no style, so the house spelling. */
const computed = (commodity: string, value: bigint, scale: number): Amount => ({ commodity, value: { value, scale }, style: null })

// An amount is written the way it was read. (from `hledger.test.ts`'s "an
// amount is written the way it was read")
test("an amount is written the way it was read", () => {
  expect(amountText(written("", 12n, 0, "number", "prefix", false))).toBe("12")
  expect(amountText(written("$", 1250n, 2, "number", "prefix", false))).toBe("$12.50")
  expect(amountText(written("$", -1250n, 2, "leading", "prefix", false))).toBe("-$12.50")
  expect(amountText(written("EUR", -100050n, 2, "number", "suffix", true))).toBe("-1000.50 EUR")
  expect(amountText(written("$", 120000n, 2, "number", "prefix", false))).toBe("$1200.00")
})

// THE HOUSE STYLE, for a number nobody wrote: a word commodity follows the
// number with a space, a symbol sits against it with none, and a minus goes in
// front of a symbol.
test("a computed amount reads in the house style", () => {
  expect(amountText(computed("$", 120000n, 2))).toBe("$1200.00")
  expect(amountText(computed("$", -120000n, 2))).toBe("-$1200.00")
  expect(amountText(computed("EUR", 5000n, 2))).toBe("50.00 EUR")
  expect(amountText(computed("", 500n, 2))).toBe("5.00")
})

// The style is asked for by commodity and sign, which is what the reading's own
// numbers need: an inferred posting and a total both come through here.
test("the house style is the one the totals are drawn in", () => {
  expect(houseStyle("$", { value: -120000n, scale: 2 })).toEqual({ sign: "leading", side: "prefix", spaced: false })
  expect(houseStyle("$", { value: 5n, scale: 0 })).toEqual({ sign: "number", side: "prefix", spaced: false })
  expect(houseStyle("EUR", { value: -50n, scale: 0 })).toEqual({ sign: "number", side: "suffix", spaced: true })
  expect(houseStyle("", { value: 1n, scale: 0 })).toEqual({ sign: "number", side: "prefix", spaced: false })
})
