import { expect, test } from "bun:test"

import { type Amount, parseAmount } from "./amount.ts"
import { text } from "./decimal.ts"

/** One amount region as an {@link Amount}, when it reads. */
const amount = (region: string): Amount => {
  const one = parseAmount(region)
  if (one === null) throw new Error(`refused: ${region}`)
  return one
}

// Money is never a float, and the separators are read the way tools write them.
//
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

// WHERE THE SIGN WAS WRITTEN is part of the amount, so the page hands back what
// the file wrote: `-$10` keeps its minus in front of the symbol, `$-10` against
// the digits, and a prefix commodity never swallows the sign into itself.
//
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

// A LEADING DECIMAL MARK is how hledger writes a fraction of one, and it is a
// number rather than something to refuse — with or without a commodity and a
// space in front of it.
test("a number may begin with its decimal mark", () => {
  expect(["$.50", ".50", ",5", "$ .25"].map((region) => text(amount(region).value))).toEqual([
    "0.50",
    "0.50",
    "0.5",
    "0.25",
  ])
  expect(amount("$ .25").style?.spaced).toBe(true)
})

// NOTHING IS MIS-READ SILENTLY. A leftover number, an exponent, a digit in an
// unquoted commodity and a number that is not a grouping are refused — never an
// amount the reader invented. (from "a posting that states something unreadable
// is kept as raw text", at the amount's own level)
// A SIGN IS SAID ONCE. `-$-10` states a minus twice, and folding the two would
// read it as PLUS ten — a silent misread of the kind this reader refuses.
test("an amount that says its sign twice is refused", () => {
  for (const region of ["-$-10", "--10", "+$+10", "-$-10 EUR"]) {
    expect(parseAmount(region), region).toBeNull()
  }
  // …while one sign, in either place, is still an amount: the value is minus
  // ten either way, and the STYLE keeps where the file put the minus.
  const leading = amount("-$10")
  expect([text(leading.value), leading.style?.sign]).toEqual(["-10", "leading"])
  const against = amount("$-10")
  expect([text(against.value), against.style?.sign]).toEqual(["-10", "number"])
})

test("each unreadable amount is refused rather than guessed at", () => {
  for (const stated of ["10 20", "1E3 X", "1.2.3", "5 AAPL2", "$1 00", "10-20", '"unterminated']) {
    expect(parseAmount(stated), stated).toBeNull()
  }
  // The escape hatch is hledger's own: write the commodity quoted.
  expect(text(amount('5 "AAPL2"').value)).toBe("5")
  expect(amount('5 "AAPL2"').commodity).toBe("AAPL2")
})

// The comment, the cost annotation and the balance assertion are cut off by
// `./posting.ts`, not here: an amount region is exactly the amount.
test("only an amount is an amount", () => {
  const ten = amount("10 EUR")
  expect([ten.commodity, text(ten.value), ten.style?.sign]).toEqual(["EUR", "10", "number"])
  expect(parseAmount("")).toBeNull()
})
