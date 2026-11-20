const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const ZERO = DIGITS[0] as string
const LAST = DIGITS[DIGITS.length - 1] as string
const BASE = DIGITS.length

const digit = (character: string): number => DIGITS.indexOf(character)

class NotAnOrd extends Error {}

export const ordBetween = (
  before: string | null,
  after: string | null,
): string | null => {
  try {
    return generateKeyBetween(before, after)
  } catch (cause) {
    if (!(cause instanceof NotAnOrd)) throw cause
    return plainBetween(before, after)
  }
}

const integerLength = (head: string): number => {
  if (head >= "a" && head <= "z") return head.charCodeAt(0) - "a".charCodeAt(0) + 2
  if (head >= "A" && head <= "Z") return "Z".charCodeAt(0) - head.charCodeAt(0) + 2
  throw new NotAnOrd(`\`${head}\` is not an order-key head`)
}

const integerPartOf = (key: string): string => {
  const head = key[0]
  if (head === undefined) throw new NotAnOrd("an order key is never empty")
  const length = integerLength(head)
  if (length > key.length) throw new NotAnOrd(`\`${key}\` is a truncated order key`)
  return key.slice(0, length)
}

const SMALLEST = `A${ZERO.repeat(26)}`

const check = (key: string): void => {
  if (key === SMALLEST) throw new NotAnOrd(`\`${key}\` is the smallest order key`)
  const fraction = key.slice(integerPartOf(key).length)
  if (fraction.endsWith(ZERO)) {
    throw new NotAnOrd(`\`${key}\` has a trailing \`${ZERO}\`, which is not canonical`)
  }
}

const increment = (integer: string): string | null => {
  const [head, ...digits] = integer.split("")
  let carry = true
  for (let at = digits.length - 1; carry && at >= 0; at--) {
    const next = digit(digits[at] as string) + 1
    if (next === BASE) digits[at] = ZERO
    else {
      digits[at] = DIGITS[next] as string
      carry = false
    }
  }
  if (!carry) return head + digits.join("")
  if (head === "Z") return `a${ZERO}`
  if (head === "z") return null
  const grown = String.fromCharCode((head as string).charCodeAt(0) + 1)
  if (grown > "a") digits.push(ZERO)
  else digits.pop()
  return grown + digits.join("")
}

const decrement = (integer: string): string | null => {
  const [head, ...digits] = integer.split("")
  let borrow = true
  for (let at = digits.length - 1; borrow && at >= 0; at--) {
    const next = digit(digits[at] as string) - 1
    if (next === -1) digits[at] = LAST
    else {
      digits[at] = DIGITS[next] as string
      borrow = false
    }
  }
  if (!borrow) return head + digits.join("")
  if (head === "a") return `Z${LAST}`
  if (head === "A") return null
  const shrunk = String.fromCharCode((head as string).charCodeAt(0) - 1)
  if (shrunk < "Z") digits.push(LAST)
  else digits.pop()
  return shrunk + digits.join("")
}

const midpoint = (a: string, b: string | null): string => {
  if (b !== null) {
    let shared = 0
    while ((a[shared] ?? ZERO) === b[shared]) shared++
    if (shared > 0) {
      return b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared))
    }
  }
  const low = a === "" ? 0 : digit(a[0] as string)
  const high = b === null || b === "" ? BASE : digit(b[0] as string)
  if (high - low > 1) return DIGITS[Math.round(0.5 * (low + high))] as string
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return (DIGITS[low] as string) + midpoint(a.slice(1), null)
}

const generateKeyBetween = (
  before: string | null,
  after: string | null,
): string => {
  if (before !== null) check(before)
  if (after !== null) check(after)
  if (before !== null && after !== null && before >= after) {
    throw new NotAnOrd(`\`${before}\` does not come before \`${after}\``)
  }

  if (before === null) {
    if (after === null) return `a${ZERO}`
    const integer = integerPartOf(after)
    const fraction = after.slice(integer.length)
    if (integer === SMALLEST) return integer + midpoint("", fraction)
    if (integer < after) return integer
    const smaller = decrement(integer)
    if (smaller === null) throw new NotAnOrd("nothing sorts before this")
    return smaller
  }

  const beforeInteger = integerPartOf(before)
  const beforeFraction = before.slice(beforeInteger.length)

  if (after === null) {
    const bigger = increment(beforeInteger)
    return bigger === null
      ? beforeInteger + midpoint(beforeFraction, null)
      : bigger
  }

  const afterInteger = integerPartOf(after)
  if (beforeInteger === afterInteger) {
    return beforeInteger + midpoint(beforeFraction, after.slice(afterInteger.length))
  }
  const bigger = increment(beforeInteger)
  if (bigger === null) throw new NotAnOrd("nothing sorts after this")
  return bigger < after ? bigger : beforeInteger + midpoint(beforeFraction, null)
}

const plainBetween = (before: string | null, after: string | null): string | null => {
  if (after === null) return `${before ?? ""}${DIGITS[Math.floor(BASE / 2)]}`
  const low = before ?? ""
  if (low >= after) return null

  let shared = 0
  while (shared < low.length && low[shared] === after[shared]) shared++
  const prefix = low.slice(0, shared)
  const lowTail = low.slice(shared)
  const highTail = after.slice(shared)

  const lowDigit = lowTail === "" ? -1 : digit(lowTail[0] as string)
  const highDigit = highTail === "" ? -1 : digit(highTail[0] as string)
  if (highDigit === -1) return null
  if (highDigit - lowDigit > 1) {
    return prefix + DIGITS[Math.floor((lowDigit + highDigit) / 2)]
  }
  if (lowDigit === -1) {
    const under = plainBetween(null, highTail.slice(1))
    return under === null ? null : prefix + (highTail[0] as string) + under
  }
  return `${prefix}${lowTail[0]}${plainBetween(lowTail.slice(1), null)}`
}
