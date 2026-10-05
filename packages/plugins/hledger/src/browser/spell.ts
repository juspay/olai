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

/** An amount as a person reads it: the number, the commodity on the side the
 *  file put it, and the sign where the file put it — or, for an amount this
 *  reader computed, the house style. */
export const amountText = (amount: Amount): string => {
  const style = amount.style ?? houseStyle(amount.commodity, amount.value)
  const quantity = decimalText(amount.value)
  if (amount.commodity === "") return quantity
  const gap = style.spaced ? " " : ""
  if (style.side === "suffix") return `${quantity}${gap}${amount.commodity}`
  if (style.sign === "leading" && quantity.startsWith("-")) {
    return `-${amount.commodity}${gap}${quantity.slice(1)}`
  }
  return `${amount.commodity}${gap}${quantity}`
}
