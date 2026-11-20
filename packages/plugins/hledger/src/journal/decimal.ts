export interface Decimal {
  readonly value: bigint
  readonly scale: number
}

export const zero: Decimal = { value: 0n, scale: 0 }

const GROUPED = /^(?:[0-9]+|[0-9]{1,3}(?:[.,][0-9]{3})+)$/

export const isDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9"

export const text = (one: Decimal): string => {
  const negative = one.value < 0n
  let digits = (negative ? -one.value : one.value).toString()
  if (one.scale > 0) {
    if (digits.length <= one.scale) digits = "0".repeat(one.scale - digits.length + 1) + digits
    digits = `${digits.slice(0, digits.length - one.scale)}.${digits.slice(digits.length - one.scale)}`
  }
  return `${negative ? "-" : ""}${digits}`
}

export const add = (left: Decimal, right: Decimal): Decimal => {
  const scale = Math.max(left.scale, right.scale)
  return {
    value: left.value * 10n ** BigInt(scale - left.scale) + right.value * 10n ** BigInt(scale - right.scale),
    scale,
  }
}

export const negate = (one: Decimal): Decimal => ({ value: -one.value, scale: one.scale })

export const scan = (from: string): { readonly written: string; readonly rest: string } | null => {
  let at = 0
  let written = ""
  if (from.startsWith("-") || from.startsWith("+")) {
    written = from[0] as string
    at = 1
  }
  while (at < from.length) {
    const char = from[at] as string
    if (isDigit(char) || char === "." || char === ",") {
      written += char
      at++
      continue
    }
    if (char === " ") {
      const group = /^ {1}([0-9]{3})(?![0-9])/.exec(from.slice(at))
      if (group === null) break
      written += group[1] as string
      at += (group[0] as string).length
      continue
    }
    break
  }
  return /[0-9]/.test(written) ? { written, rest: from.slice(at) } : null
}

export const parse = (raw: string): Decimal | null => {
  let digits = raw.replace(/ /g, "")
  let negative = false
  if (digits.startsWith("-")) {
    negative = true
    digits = digits.slice(1)
  } else if (digits.startsWith("+")) digits = digits.slice(1)
  if (digits === "") return null

  const dots: Array<number> = []
  const commas: Array<number> = []
  for (let at = 0; at < digits.length; at++) {
    const char = digits.charAt(at)
    if (char === ".") dots.push(at)
    else if (char === ",") commas.push(at)
    else if (!isDigit(char)) return null
  }
  let mark = -1
  if (dots.length > 0 && commas.length > 0) mark = Math.max(dots[dots.length - 1] as number, commas[commas.length - 1] as number)
  else if (dots.length === 1) mark = dots[0] as number
  else if (commas.length === 1) {
    const only = commas[0] as number
    if (digits.length - only - 1 <= 2) mark = only
  }

  const whole = (mark >= 0 ? digits.slice(0, mark) : digits) || "0"
  const fraction = mark >= 0 ? digits.slice(mark + 1) : ""
  if (!GROUPED.test(whole)) return null
  if (!/^[0-9]*$/.test(fraction)) return null
  const value = BigInt(whole.replace(/[.,]/g, "") + fraction)
  return { value: negative ? -value : value, scale: fraction.length }
}
