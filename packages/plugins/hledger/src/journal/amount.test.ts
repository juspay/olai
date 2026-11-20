import { expect, test } from "bun:test"

import { type Amount, parseAmount } from "./amount.ts"
import { text } from "./decimal.ts"

const amount = (region: string): Amount => {
  const one = parseAmount(region)
  if (one === null) throw new Error(`refused: ${region}`)
  return one
}

test("amounts are exact, on either side of the number", () => {
  const read = (region: string) => {
    const one = amount(region)
    return { commodity: one.commodity, digits: text(one.value) }
  }
  expect(
    ["-1,000.50 EUR", "10 USD", '"quoted commodity" 5', "€1,50", '-5 "quoted commodity"', "1.000,50 EUR", "$1 000.00"].map(read),
  ).toEqual([
    { commodity: "EUR", digits: "-1000.50" },
    { commodity: "USD", digits: "10" },
    { commodity: "quoted commodity", digits: "5" },
    { commodity: "€", digits: "1.50" },
    { commodity: "quoted commodity", digits: "-5" },
    { commodity: "EUR", digits: "1000.50" },
    { commodity: "$", digits: "1000.00" },
  ])
})

test("a sign is read as a sign and not as part of the commodity", () => {
  const written = ["$-10", "-$10", "EUR-5", "-5 EUR"].map((region) => {
    const one = amount(region)
    return [one.commodity, text(one.value), one.style?.sign] as const
  })
  expect(written).toEqual([
    ["$", "-10", "number"],
    ["$", "-10", "leading"],
    ["EUR", "-5", "number"],
    ["EUR", "-5", "number"],
  ])
})

test("a number may begin with its decimal mark", () => {
  expect(["$.50", ".50", ",5", "$ .25"].map((region) => text(amount(region).value))).toEqual([
    "0.50",
    "0.50",
    "0.5",
    "0.25",
  ])
  expect(amount("$ .25").style?.spaced).toBe(true)
})

test("an amount that says its sign twice is refused", () => {
  for (const region of ["-$-10", "--10", "+$+10", "-$-10 EUR"]) {
    expect(parseAmount(region), region).toBeNull()
  }
  const leading = amount("-$10")
  expect([text(leading.value), leading.style?.sign]).toEqual(["-10", "leading"])
  const against = amount("$-10")
  expect([text(against.value), against.style?.sign]).toEqual(["-10", "number"])
})

test("each unreadable amount is refused rather than guessed at", () => {
  for (const stated of ["10 20", "1E3 X", "1.2.3", "5 AAPL2", "$1 00", "10-20", '"unterminated']) {
    expect(parseAmount(stated), stated).toBeNull()
  }
  expect(text(amount('5 "AAPL2"').value)).toBe("5")
  expect(amount('5 "AAPL2"').commodity).toBe("AAPL2")
})

test("only an amount is an amount", () => {
  const ten = amount("10 EUR")
  expect([ten.commodity, text(ten.value), ten.style?.sign]).toEqual(["EUR", "10", "number"])
  expect(parseAmount("")).toBeNull()
})
