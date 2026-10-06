/**
 * HOW AN AMOUNT READS — the one place an amount becomes text, and the house
 * style the reading's own numbers are written in.
 *
 * Split from {@link ./views.tsx} so that "what $1200.00 looks like" is one
 * answer: a row's `data-amount` and the amount drawn beside it are the same
 * string, and a second spinner of the same number would be two answers the
 * markup and the attribute could disagree about. The journal hands back the
 * numbers and the STYLE the file wrote them in (`../journal/amount.ts`); what a
 * style of `null` (an inferred amount, a computed total) reads as is here.
 *
 * AS THE FILE WROTE IT, when the file wrote it: `Amount.written` keeps the
 * digits' own grouping (`4,250.00`), and only an amount the reader computed —
 * an inferred posting, an account total — is spelled from `decimalText` and
 * then grouped by the house (the integer part in threes, once it has four
 * digits). The SIGN is put back where the style says it goes, because `written`
 * carries the digits and the style carries the sign's position (`-$10` and
 * `$-10` are the same money, written two ways).
 *
 * A word commodity follows the number with a space, a symbol sits against it
 * with none, and a minus goes IN FRONT of a symbol (`-$1200.00`) — the exact
 * text a reader checks against their own arithmetic.
 */
import { type Amount, type Decimal, decimalText, type Style } from "../journal/index.ts"

/** The house style for an amount nobody wrote: a word commodity after the
 *  number with a space, a symbol before it with none, and a minus in front of a
 *  symbol. */
export const houseStyle = (commodity: string, value: Decimal): Style => {
  if (commodity === "") return { sign: "number", side: "prefix", spaced: false }
  if (/^[A-Za-z]/.test(commodity)) return { sign: "number", side: "suffix", spaced: true }
  return {
    // The SIGN is read off the number, not off the text it renders as: a house
    // style decided by a string is a style that would change if the spelling did.
    sign: value.value < 0n ? "leading" : "number",
    side: "prefix",
    spaced: false,
  }
}

/** An amount's three runs, for a grid that aligns the numbers: what sits
 *  before the digits, the digits, and what follows them. The number run is
 *  what a right-aligned `tabular-nums` column lines up. */
export interface AmountParts {
  readonly prefix: string
  readonly number: string
  readonly suffix: string
}

/** The digits an amount is drawn with — the file's own grouping when it wrote
 *  one, the computed number grouped by the house when the reader computed it.
 *  The sign is NOT here; it is placed by {@link amountParts}, where the style
 *  says. */
const digits = (amount: Amount): string =>
  amount.written ?? groupedDigits(decimalText(amount.value).replace(/^-/, ""))

/** The integer part of an unsigned number grouped in threes, the way a person
 *  reads money — and only once there are four or more digits, so `120.50`
 *  stays `120.50` and `1000.50` becomes `1,000.50`. A computed total is the
 *  only caller: a number the FILE wrote keeps the file's own separators, which
 *  `./spell.ts`'s `written` path never touches. */
const groupedDigits = (text: string): string => {
  const dot = text.indexOf(".")
  const whole = dot < 0 ? text : text.slice(0, dot)
  if (whole.length <= 3) return text
  let out = ""
  for (let at = 0; at < whole.length; at++) {
    if (at > 0 && (whole.length - at) % 3 === 0) out += ","
    out += whole[at]
  }
  return `${out}${dot < 0 ? "" : text.slice(dot)}`
}

/** An amount split into prefix / number / suffix, in the file's own style (or
 *  the house style for a computed one). */
export const amountParts = (amount: Amount): AmountParts => {
  const style = amount.style ?? houseStyle(amount.commodity, amount.value)
  const sign = amount.value.value < 0n ? "-" : ""
  const quantity = digits(amount)
  if (amount.commodity === "") return { prefix: "", number: `${sign}${quantity}`, suffix: "" }
  const gap = style.spaced ? " " : ""
  if (style.side === "suffix") {
    // The number carries its sign in front of itself (`-10 EUR`).
    return { prefix: "", number: `${sign}${quantity}`, suffix: `${gap}${amount.commodity}` }
  }
  if (style.sign === "leading") {
    // A minus before a prefix commodity (`-$10`).
    return { prefix: `${sign}${amount.commodity}${gap}`, number: quantity, suffix: "" }
  }
  // The ordinary prefix amount: `$10`, `$-10`, `$ 10`.
  return { prefix: `${amount.commodity}${gap}`, number: `${sign}${quantity}`, suffix: "" }
}

/** An amount as a person reads it: the number, the commodity on the side the
 *  file put it, and the sign where the file put it — or, for an amount this
 *  reader computed, the house style. */
export const amountText = (amount: Amount): string => {
  const parts = amountParts(amount)
  return `${parts.prefix}${parts.number}${parts.suffix}`
}

/** The amount's number and sign ALONE, with no commodity — `19,031.05`,
 *  `-51.88`, `5`.
 *
 *  For a column that names its commodity once: the balances tree heads each
 *  column with it, so a cell repeating it would say `EUR` twice. The sign is
 *  not the commodity's and stays, which is the one case the parts cannot answer
 *  alone: a file that wrote `-$10` keeps its minus in the PREFIX, and the
 *  number beside it is unsigned. */
export const amountDigits = (amount: Amount): string => {
  const parts = amountParts(amount)
  const leading = (amount.style ?? houseStyle(amount.commodity, amount.value)).sign === "leading"
  return leading && amount.value.value < 0n ? `-${parts.number}` : parts.number
}
