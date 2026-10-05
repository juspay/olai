import { expect, test } from "bun:test"

import { add, negate, parse, scan, text } from "./decimal.ts"

/** The digits a written number comes to, or `null` when it is not one — the
 *  round trip a page's text is built from. */
const digits = (raw: string): string | null => {
  const one = parse(raw)
  return one === null ? null : text(one)
}

// Money is never a float, and the separators are read the way tools write them.
// (from `hledger.test.ts`'s "amounts are exact, on either side of the number",
// at the decimal's own level)
test("a written number is read exactly, by the separators tools write", () => {
  expect(digits("-1,000.50")).toBe("-1000.50")
  expect(digits("1.000,50")).toBe("1000.50")
  expect(digits("1000")).toBe("1000")
  expect(digits("1 000.00")).toBe("1000.00")
  expect(digits("1,50")).toBe("1.50")
  expect(digits("0.005")).toBe("0.005")
  expect(digits("1.2.3")).toBeNull()
  expect(digits("1,00,000")).toBeNull()
  expect(digits("1e3")).toBeNull()
  expect(digits("")).toBeNull()
})

// A LEADING DECIMAL MARK is how hledger writes a fraction of one, and it is a
// number rather than something to refuse. (from "a number may begin with its
// decimal mark")
test("a number may begin with its decimal mark", () => {
  expect(digits(".50")).toBe("0.50")
  expect(digits(",5")).toBe("0.5")
})

// A SPACE IS GROUPING ONLY WHEN IT SEPARATES A GROUP OF THREE — `1 000.00` is a
// number and `10 20` is not, which is the difference between reading somebody's
// amount and inventing one.
test("scan takes a written number, and a space only groups in threes", () => {
  expect(scan("1 000.00")).toEqual({ written: "1000.00", rest: "" })
  expect(scan("10 20")).toEqual({ written: "10", rest: " 20" })
  expect(scan("-1,000.50 EUR")).toEqual({ written: "-1,000.50", rest: " EUR" })
  expect(scan("abc")).toBeNull()
  expect(scan(".")).toBeNull()
})

// The arithmetic the whole reading rests on: exact at any scale.
test("decimals add and negate exactly", () => {
  expect(text(add({ value: 1n, scale: 0 }, { value: 5n, scale: 1 }))).toBe("1.5")
  expect(text(add({ value: -100050n, scale: 2 }, { value: 50n, scale: 2 }))).toBe("-1000.00")
  expect(text(negate({ value: 12050n, scale: 2 }))).toBe("-120.50")
})
