/**
 * `ord`: where a node sits among its siblings, as a string.
 *
 * The format stores sibling order as a fractional index over base62 and sorts
 * it with plain string comparison ({@link ./derive.ts}). Inserting between two
 * neighbours therefore has to mint a string that lands strictly between them
 * WITHOUT touching either — that is the whole point of a fractional index, and
 * it is why an insert is a one-line write rather than a renumbering of the
 * file.
 *
 * The algorithm is Implementing Fractional Indexing (David Greenspan), the one
 * `fractional-indexing` implements — carried here rather than depended on,
 * because base62 in ASCII order is a statement about THIS format's `ord` field
 * and the whole of it is the eighty lines below. Its shape matters: a key is an
 * integer part (a length-prefixed magnitude, so appends stay short — `a0`,
 * `a1`, `a2`, … not `V`, `Vk`, `Vkk`) followed by a fractional part that only
 * grows when something is inserted BETWEEN two existing neighbours.
 *
 * Two properties are load-bearing and both are tested:
 *
 *   - the digits are `0-9A-Za-z`, which is ASCII order, so the string
 *     comparison the format promises IS numeric order in this encoding;
 *   - it answers for `ord`s this encoding never minted. `ord` is validated as a
 *     string and nothing more, so a hand-written outline may hold anything;
 *     those fall through to {@link plainBetween}, which converges more slowly
 *     but answers for any two base62 strings that have room between them. An
 *     insert must not fail merely because somebody typed a neighbour by hand.
 *
 * There is one pair with no answer at all, and it is arithmetic rather than a
 * gap in the implementation: nothing sorts between `x` and `x0`, because every
 * string above `x` begins with `x` and the least of those IS `x0`. So the
 * return is `string | null`, and `null` means "these two neighbours leave no
 * room" — the caller's cue to renumber the row rather than to guess. Typed
 * that way rather than thrown because it is a fact about the data, not a bug.
 */

/** Base62, in ASCII order — so `a < b` as strings is `a < b` as fractions. */
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const ZERO = DIGITS[0] as string
const LAST = DIGITS[DIGITS.length - 1] as string
const BASE = DIGITS.length

const digit = (character: string): number => DIGITS.indexOf(character)

/** Something about the two neighbours this encoding cannot answer for. Caught
 *  inside this module — the fallback below answers instead — so it never
 *  reaches a caller. */
class NotAnOrd extends Error {}

/**
 * A key strictly between `before` and `after`, either of which may be `null`
 * for "nothing on that side" — or `null` when the two leave no room at all.
 *
 * `ordBetween(null, null)` is the first child of an empty parent, and
 * `ordBetween(last, null)` is the append every capture does.
 */
export const ordBetween = (
  before: string | null,
  after: string | null,
): string | null => {
  try {
    return generateKeyBetween(before, after)
  } catch (cause) {
    if (!(cause instanceof NotAnOrd)) throw cause
    // A neighbour this encoding never minted. Not an error: the format lets a
    // person write any string there, and an insert next to one still has to
    // land somewhere.
    return plainBetween(before, after)
  }
}

// ── the fractional index ───────────────────────────────────────────────

/** How many digits follow the head. `a`…`z` count up from 2 and `A`…`Z` count
 *  down, which is what makes a longer integer part sort above a shorter one on
 *  the positive side and below it on the negative. */
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

/** The smallest integer part there is. Nothing may be minted below it. */
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

/** Halfway between two FRACTIONS (the part after the integer part), each
 *  written without a trailing zero. */
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
  // Consecutive digits: descend into `a`'s tail rather than inventing a digit
  // there is no room for.
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

// ── the answer for keys this encoding never minted ─────────────────────

/**
 * A base62 string strictly between two arbitrary ones, or `null` when there is
 * none.
 *
 * No integer part and no length prefix: this treats both neighbours as plain
 * digit sequences and finds a string between them. It converges more slowly
 * than the encoding above — repeated inserts against the same neighbour grow
 * one character each — and that is the right trade for the case it exists to
 * cover: a neighbour somebody typed by hand, which the next write past it
 * re-anchors anyway.
 *
 * `null` comes back for exactly one shape, and it is arithmetic: `after` is
 * `before` with zeros appended, so there is nothing in between. The caller
 * renumbers.
 */
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
  // `after` ran out first, so it is a prefix of `before` — `low >= after`
  // already refused that, and this is the same fact re-derived one level down.
  if (highDigit === -1) return null
  if (highDigit - lowDigit > 1) {
    return prefix + DIGITS[Math.floor((lowDigit + highDigit) / 2)]
  }
  if (lowDigit === -1) {
    // Nothing on the low side and no gap below `after`'s first digit: keep that
    // digit and look for room underneath it. `after` being all zeros from here
    // is the one shape with no answer, and the recursion reports it.
    const under = plainBetween(null, highTail.slice(1))
    return under === null ? null : prefix + (highTail[0] as string) + under
  }
  // The digits are consecutive: stay on `before`'s and grow past its tail.
  return `${prefix}${lowTail[0]}${plainBetween(lowTail.slice(1), null)}`
}
