/**
 * THE EXACT DIGITS OF A NUMBER — money that is never a float, and the two
 * spellings every tool writes.
 *
 * A quantity is a `bigint` scaled by the number of decimal places it was
 * written with, so `-1,000.50` is exactly `-100050/100` and a sum of ten
 * thousand of them is exact. There is no rounding here and no binary point: the
 * reading's whole claim is that the arithmetic on the page is the arithmetic a
 * person checks by hand.
 *
 * THE DECIMAL MARK is decided by what is around it rather than by a `D`
 * directive, and the two rules are the two conventions every tool writes:
 *
 *   - when both `.` and `,` appear, whichever comes LAST is the mark and the
 *     other is grouping (`-1,000.50` and `1.000,50` both read as they look);
 *   - with only one kind present, a lone `,` followed by one or two digits is a
 *     mark (`1,50` is one and a half), while anything else is grouping
 *     (`1,000` is a thousand, `1,000,000` is a million) — and a `.` is always a
 *     mark, because that is hledger's default and the one every English-writing
 *     tool emits.
 *
 * EVERYTHING ELSE IS REFUSED rather than trimmed: the integer part must be a
 * genuine digit grouping ({@link GROUPED}) and the fraction must be digits, so
 * `1.2.3` is not quietly read as `12.3`. A misread is the failure this reader
 * refuses — the page will not invent a number somebody did not write.
 */

/** One exact decimal: `value` scaled by `10^-scale`. */
export interface Decimal {
  readonly value: bigint
  readonly scale: number
}

/** The additive identity, in the scale every sum can start from. */
export const zero: Decimal = { value: 0n, scale: 0 }

/** A number's digit groups: digits, and separators that are exactly one
 *  thousand. `1,000,000`, `1.000.000` and `1000` are all numbers; `1.2.3` and
 *  `1,00,000` are not. */
const GROUPED = /^(?:[0-9]+|[0-9]{1,3}(?:[.,][0-9]{3})+)$/

/** Whether a character is one of the ten — the one place a digit is judged. */
export const isDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9"

/** The exact digits of a decimal, as the text they were written as. */
export const text = (one: Decimal): string => {
  const negative = one.value < 0n
  let digits = (negative ? -one.value : one.value).toString()
  if (one.scale > 0) {
    if (digits.length <= one.scale) digits = "0".repeat(one.scale - digits.length + 1) + digits
    digits = `${digits.slice(0, digits.length - one.scale)}.${digits.slice(digits.length - one.scale)}`
  }
  return `${negative ? "-" : ""}${digits}`
}

/** Two decimals summed, at the wider of their scales — exact, however many
 *  places either was written with. */
export const add = (left: Decimal, right: Decimal): Decimal => {
  const scale = Math.max(left.scale, right.scale)
  return {
    value: left.value * 10n ** BigInt(scale - left.scale) + right.value * 10n ** BigInt(scale - right.scale),
    scale,
  }
}

/** A decimal with its sign flipped — what an inference fills an omission with. */
export const negate = (one: Decimal): Decimal => ({ value: -one.value, scale: one.scale })

/**
 * The digits at the head of some text, and what is left after them.
 *
 * A SPACE IS GROUPING ONLY WHEN IT SEPARATES A GROUP OF THREE — `1 000.00` is
 * a number and `10 20` is not, which is the difference between reading
 * somebody's amount and inventing one.
 */
export const scan = (from: string): { readonly written: string; readonly rest: string } | null => {
  let at = 0
  // The sign rides along in `written`, because the caller is what decides what
  // it means (a leading sign before a commodity, or the number's own).
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
  // SOMETHING WITH NO DIGIT IN IT IS NOT A NUMBER — a lone mark, or nothing —
  // and a leading mark is allowed, because `.50` is how hledger writes half.
  return /[0-9]/.test(written) ? { written, rest: from.slice(at) } : null
}

/**
 * The exact digits of a written number, or `null` when they are not a number.
 *
 * The mark and the grouping are argued above; what this adds is the refusal:
 * the integer part must be a genuine {@link GROUPED} grouping and the fraction
 * must be digits, or the whole thing is not a number this reader will repeat.
 */
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
  // MORE THAN ONE MARK AND NO OTHER KIND IS GROUPING, not a fraction: `1.000.000`
  // is a million, which is what the {@link GROUPED} comment above promises and
  // what the comma rule already did. A SINGLE mark stays the decimal one —
  // hledger's default, and the ambiguity a `commodity`/`decimal-mark` directive
  // would settle (this reader does not read directives, so `1.000` is one and
  // three thousandths, the way hledger without such a directive reads it).

  // `.50` has no integer part at all, which is zero rather than a refusal.
  const whole = (mark >= 0 ? digits.slice(0, mark) : digits) || "0"
  const fraction = mark >= 0 ? digits.slice(mark + 1) : ""
  if (!GROUPED.test(whole)) return null
  if (!/^[0-9]*$/.test(fraction)) return null
  const value = BigInt(whole.replace(/[.,]/g, "") + fraction)
  return { value: negative ? -value : value, scale: fraction.length }
}
