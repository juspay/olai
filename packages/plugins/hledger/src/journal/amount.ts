/**
 * ONE AMOUNT, AS IT WAS WRITTEN — a commodity, the exact number under it, and
 * where the file put the signs.
 *
 * The number is a {@link Decimal} rather than a string, so a sum of amounts is
 * exact and never a float. WHERE it was written is a {@link Style}, and a
 * `null` style is the reading adding an amount the file did not write: an
 * inferred balance, or an account's total. `null` and not a default, because a
 * default here would be this reader claiming the file wrote something it did
 * not — the display picks the house style for a `null` one (`../browser/spell.ts`).
 *
 * NOTHING IS MIS-READ SILENTLY. Three shapes are refused rather than guessed: an
 * unquoted commodity that holds a digit (`1E3 X`, and `AAPL2` — write the
 * commodity quoted, `"AAPL2"`, if that is what it is), a second number left
 * over after the first, and a number whose separators are not digit groups
 * (`1.2.3`). What IS supported is the grouping a person writes: `1,000,000.50`,
 * `1.000,50`, and a space between groups (`$1 000.00`).
 */
import { type Decimal, isDigit, negate, parse, scan } from "./decimal.ts"

/** Where the sign and the commodity sat, as the file wrote them: `-$10` and
 *  `$-10` are the same money written two ways, and the page hands back the one
 *  the file used. A `null` {@link Amount.style} means nobody wrote this one. */
export interface Style {
  readonly sign: "leading" | "number"
  readonly side: "prefix" | "suffix"
  readonly spaced: boolean
}

/** One amount: the commodity, the exact quantity under it, how it was written
 *  — or a `null` style when this reader computed it (an inferred amount, or a
 *  total) — and the DIGITS the file wrote, grouping and all, which a computed
 *  amount has none of. The value is the arithmetic; `written` is the file's own
 *  spelling of it, which is what a page drawing somebody's journal should show. */
export interface Amount {
  readonly commodity: string
  readonly value: Decimal
  readonly style: Style | null
  readonly written: string | null
}

/** An unquoted commodity: no whitespace, no digit and none of the characters
 *  that mean something else on the line. A commodity that holds one of those is
 *  written quoted (`"quoted commodity"`, `"AAPL2"`), which is how hledger lets
 *  it be said at all. ONE regex, read two ways: a whole token ({@link
 *  commodityOf}), and the run at the head of a prefix amount. */
const BARE = /^[^0-9\s+\-".@=;,#*!()[\]]+/

/** The commodity a token names, or `null` when the token is not one — quoted,
 *  or bare. A bare commodity is the run only when it is the WHOLE token. */
const commodityOf = (token: string): string | null => {
  if (token.startsWith('"')) {
    return token.length > 2 && token.endsWith('"') ? token.slice(1, -1) : null
  }
  const found = BARE.exec(token)
  return found !== null && found[0] === token ? token : null
}

/**
 * One posting's amount region — everything after the account, minus the
 * comment, the cost annotation and the balance assertion — as the amount it
 * states.
 *
 * `null` is a region that is NOT an amount. The caller tells that from an
 * omission by the region being empty, and files the line as raw text, which is
 * the whole of "nothing is mis-read silently".
 */
export const parseAmount = (region: string): Amount | null => {
  let text = region.trim()
  if (text === "") return null
  let leading = false
  let negative = false
  if (text.startsWith("-") || text.startsWith("+")) {
    leading = true
    negative = text.startsWith("-")
    text = text.slice(1).trimStart()
  }

  let commodity = ""
  let side: "prefix" | "suffix" = "prefix"
  let spaced = false
  let written = ""

  const first = text[0]
  if (text.startsWith('"')) {
    const end = text.indexOf('"', 1)
    if (end < 0) return null
    commodity = text.slice(1, end)
    const rest = text.slice(end + 1)
    spaced = /^\s/.test(rest)
    const number = scan(rest.trimStart())
    if (number === null || number.rest.trim() !== "") return null
    written = number.written
  } else if (isDigit(first) || first === "." || first === ",") {
    const number = scan(text)
    if (number === null) return null
    written = number.written
    spaced = /^\s/.test(number.rest)
    const token = number.rest.trim()
    if (token !== "") {
      const named = commodityOf(token)
      if (named === null) return null
      commodity = named
    }
    side = "suffix"
  } else {
    // A commodity on the left: `$10`, `€ 10`, `US$10`, `USD 10` — and NOT the
    // sign, which the branch above already took off (`$-10` is minus ten).
    const found = BARE.exec(text)
    if (found === null) return null
    commodity = found[0]
    const rest = text.slice(commodity.length)
    spaced = /^\s/.test(rest)
    const number = scan(rest.trimStart())
    if (number === null || number.rest.trim() !== "") return null
    written = number.written
  }

  // A sign may also sit against the digits: `$-10`, `10-` is not a thing, and
  // `-10 EUR` had it before the digits already. A SIGN IS SAID ONCE, though:
  // `-$-10` carries two of them and would read as PLUS ten if they were folded
  // into each other, so an amount that says it twice is refused rather than
  // guessed at — the same rule as every other unreadable amount here.
  if (written.startsWith("-") || written.startsWith("+")) {
    if (leading) return null
    negative = written.startsWith("-")
    written = written.slice(1)
    if (written.startsWith("-") || written.startsWith("+")) return null
  }
  const value = parse(written)
  if (value === null) return null
  const exact = negative ? negate(value) : value
  return {
    commodity,
    value: exact,
    written,
    style: {
      // The sign is LEADING only where it was written before a prefix
      // commodity (`-$10`); everywhere else the number carries it.
      sign: leading && negative && side === "prefix" ? "leading" : "number",
      side,
      spaced,
    },
  }
}
