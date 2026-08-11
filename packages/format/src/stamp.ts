/**
 * An instant, as the text this format stores.
 *
 * Reading a date is deliberately textual (./parse.ts): a value is written back
 * exactly as it was read, so a date-only `2026-08-10` cannot come back a
 * datetime. This is the other direction, and it is the only one that reaches a
 * FILE: every date value olai writes is minted here. It lives beside the rule
 * that accepts one so that what olai writes and what olai accepts are two
 * functions in one package, rather than a writer somewhere above guessing at a
 * shape this one validates.
 *
 * The browser's clock (`@olai/web`'s `clock.ts`) also turns an instant into
 * date text, and that is not this rule twice: what it mints is a QUESTION —
 * which day `/today` is — and nothing it produces is ever stored. The two do
 * have to agree about where a local day ends, and that agreement is a test
 * rather than an argument (`clock.test.ts`).
 *
 * LOCAL, with the offset spelled out (`2026-08-11T15:40:03-04:00`). A mark is
 * stamped where the person marking it is standing, and that is the day they
 * would say the work was finished on: a `Z` instant would file eight in the
 * evening in New York under the next morning, on the day page of a day that
 * had not started yet. The offset is written rather than assumed, so the value
 * still names ONE instant when it is read from anywhere else — which is the
 * half a bare local datetime loses.
 *
 * Seconds and no further. A completion time is a thing a person reads.
 */

/** Zero-padded, and wide enough to be handed a year. */
const pad = (value: number, width = 2): string => String(value).padStart(width, "0")

/**
 * The zone offset as ISO writes it, from the number `Date` reports: the minutes
 * to ADD to local time to reach UTC.
 *
 * So the sign inverts here — a reported 240 is four hours BEHIND UTC, which ISO
 * spells `-04:00` — and that inversion is the one thing in this module that can
 * be wrong while everything still looks like a date, which is why it is a
 * function with a name and a test rather than a minus sign inside a template.
 */
export const offsetOf = (minutes: number): string => {
  const east = -minutes
  const size = Math.abs(east)
  return `${east < 0 ? "-" : "+"}${pad(Math.trunc(size / 60))}:${pad(size % 60)}`
}

/** The instant `at`, as an ISO datetime in the local zone. */
export const stampOf = (at: Date): string =>
  `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
  `T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}` +
  offsetOf(at.getTimezoneOffset())
