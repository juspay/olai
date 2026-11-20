import { type Amount, type Decimal, decimalText, type Style } from "../journal/index.ts"

export const houseStyle = (commodity: string, value: Decimal): Style => {
  if (commodity === "") return { sign: "number", side: "prefix", spaced: false }
  if (/^[A-Za-z]/.test(commodity)) return { sign: "number", side: "suffix", spaced: true }
  return {
    sign: value.value < 0n ? "leading" : "number",
    side: "prefix",
    spaced: false,
  }
}

export interface AmountParts {
  readonly prefix: string
  readonly number: string
  readonly suffix: string
}

const digits = (amount: Amount): string =>
  amount.written ?? groupedDigits(decimalText(amount.value).replace(/^-/, ""))

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

export const amountParts = (amount: Amount): AmountParts => {
  const style = amount.style ?? houseStyle(amount.commodity, amount.value)
  const sign = amount.value.value < 0n ? "-" : ""
  const quantity = digits(amount)
  if (amount.commodity === "") return { prefix: "", number: `${sign}${quantity}`, suffix: "" }
  const gap = style.spaced ? " " : ""
  if (style.side === "suffix") {
    return { prefix: "", number: `${sign}${quantity}`, suffix: `${gap}${amount.commodity}` }
  }
  if (style.sign === "leading") {
    return { prefix: `${sign}${amount.commodity}${gap}`, number: quantity, suffix: "" }
  }
  return { prefix: `${amount.commodity}${gap}`, number: `${sign}${quantity}`, suffix: "" }
}

export const amountText = (amount: Amount): string => {
  const parts = amountParts(amount)
  return `${parts.prefix}${parts.number}${parts.suffix}`
}

export const amountDigits = (amount: Amount): string => {
  const parts = amountParts(amount)
  const leading = (amount.style ?? houseStyle(amount.commodity, amount.value)).sign === "leading"
  return leading && amount.value.value < 0n ? `-${parts.number}` : parts.number
}
