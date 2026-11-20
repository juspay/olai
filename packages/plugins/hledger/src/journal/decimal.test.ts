import { expect, test } from "bun:test"

import { add, negate, parse, scan, text } from "./decimal.ts"

const digits = (raw: string): string | null => {
  const one = parse(raw)
  return one === null ? null : text(one)
}

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

test("a repeated mark is a grouping and a single one is the decimal mark", () => {
  expect(digits("1.000.000")).toBe("1000000")
  expect(digits("1,000,000")).toBe("1000000")
  expect(digits("1.000.000,50")).toBe("1000000.50")
  expect(digits("1.000,50")).toBe("1000.50")
  expect(digits("1,000.50")).toBe("1000.50")
  expect(digits("1.000")).toBe("1.000")
  expect(digits("1.000.50")).toBeNull()
})

test("a number may begin with its decimal mark", () => {
  expect(digits(".50")).toBe("0.50")
  expect(digits(",5")).toBe("0.5")
})

test("scan takes a written number, and a space only groups in threes", () => {
  expect(scan("1 000.00")).toEqual({ written: "1000.00", rest: "" })
  expect(scan("10 20")).toEqual({ written: "10", rest: " 20" })
  expect(scan("-1,000.50 EUR")).toEqual({ written: "-1,000.50", rest: " EUR" })
  expect(scan("abc")).toBeNull()
  expect(scan(".")).toBeNull()
})

test("decimals add and negate exactly", () => {
  expect(text(add({ value: 1n, scale: 0 }, { value: 5n, scale: 1 }))).toBe("1.5")
  expect(text(add({ value: -100050n, scale: 2 }, { value: 50n, scale: 2 }))).toBe("-1000.00")
  expect(text(negate({ value: 12050n, scale: 2 }))).toBe("-120.50")
})
