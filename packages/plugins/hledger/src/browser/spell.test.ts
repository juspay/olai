import { expect, test } from "bun:test"

import { type Amount, decimalText } from "../journal/index.ts"
import { amountText, houseStyle } from "./spell.ts"

const plain = (value: bigint, scale: number): string =>
  decimalText({ value: value < 0n ? -value : value, scale })

const written = (commodity: string, value: bigint, scale: number, sign: "leading" | "number", side: "prefix" | "suffix", spaced: boolean): Amount => ({
  commodity,
  value: { value, scale },
  style: { sign, side, spaced },
  written: plain(value, scale),
})

const computed = (commodity: string, value: bigint, scale: number): Amount => ({ commodity, value: { value, scale }, style: null, written: null })

const grouped = (commodity: string, value: bigint, scale: number, digits: string, sign: "leading" | "number", side: "prefix" | "suffix", spaced: boolean): Amount => ({
  commodity,
  value: { value, scale },
  style: { sign, side, spaced },
  written: digits,
})

test("a written amount keeps the file's grouping", () => {
  expect(amountText(grouped("$", 425000n, 2, "4,250.00", "number", "prefix", false))).toBe("$4,250.00")
  expect(amountText(grouped("$", -185000n, 2, "1,850.00", "leading", "prefix", false))).toBe("-$1,850.00")
  expect(amountText(grouped("EUR", 100000n, 2, "1.000,00", "number", "suffix", true))).toBe("1.000,00 EUR")
  expect(amountText(grouped("$", -1000n, 2, "10.00", "number", "prefix", false))).toBe("$-10.00")
})

test("an amount is written the way it was read", () => {
  expect(amountText(written("", 12n, 0, "number", "prefix", false))).toBe("12")
  expect(amountText(written("$", 1250n, 2, "number", "prefix", false))).toBe("$12.50")
  expect(amountText(written("$", -1250n, 2, "leading", "prefix", false))).toBe("-$12.50")
  expect(amountText(written("EUR", -100050n, 2, "number", "suffix", true))).toBe("-1000.50 EUR")
  expect(amountText(written("$", 120000n, 2, "number", "prefix", false))).toBe("$1200.00")
})

test("a computed amount reads in the house style", () => {
  expect(amountText(computed("$", 120000n, 2))).toBe("$1,200.00")
  expect(amountText(computed("$", -120000n, 2))).toBe("-$1,200.00")
  expect(amountText(computed("EUR", 5000n, 2))).toBe("50.00 EUR")
  expect(amountText(computed("", 500n, 2))).toBe("5.00")
  expect(amountText(computed("$", 12050n, 2))).toBe("$120.50")
  expect(amountText(computed("$", 100050n, 2))).toBe("$1,000.50")
  expect(amountText(computed("", 1903105n, 2))).toBe("19,031.05")
})

test("the house style is the one the totals are drawn in", () => {
  expect(houseStyle("$", { value: -120000n, scale: 2 })).toEqual({ sign: "leading", side: "prefix", spaced: false })
  expect(houseStyle("$", { value: 5n, scale: 0 })).toEqual({ sign: "number", side: "prefix", spaced: false })
  expect(houseStyle("EUR", { value: -50n, scale: 0 })).toEqual({ sign: "number", side: "suffix", spaced: true })
  expect(houseStyle("", { value: 1n, scale: 0 })).toEqual({ sign: "number", side: "prefix", spaced: false })
})
