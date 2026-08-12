/**
 * How long ago, in a phrase.
 *
 * The last commit is dated in the repository, in ISO 8601, and what a reader
 * wants to know is whether it was a minute ago or last week. That is a reading
 * of a CLOCK, so it moves on its own: a pill saying "12m ago" for the next four
 * hours would be worse than one saying nothing, and the pending value it is
 * drawn beside can sit unchanged all afternoon.
 *
 * The arithmetic is PURE and takes `now` as an argument, so it is a table of
 * cases in a unit test rather than something you have to wait an hour to see.
 * Only the ticking half touches a clock.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * `at` as a phrase relative to `now`.
 *
 * Coarse on purpose, and it gets coarser as it goes back: seconds matter for
 * something that just happened and nothing else does. A future stamp — a clock
 * that disagrees with the repository's, which happens across machines — reads
 * as "just now" rather than as a negative number.
 */
export const agoOf = (at: string, now: number): string => {
  const then = Date.parse(at)
  if (Number.isNaN(then)) return ""
  const since = now - then
  if (since < MINUTE) return "just now"
  if (since < HOUR) return `${Math.floor(since / MINUTE)}m ago`
  if (since < DAY) return `${Math.floor(since / HOUR)}h ago`
  return `${Math.floor(since / DAY)}d ago`
}

/** How often the phrase is re-read. A minute, because that is the finest
 *  distinction it draws above "just now". */
const TICK = MINUTE

/**
 * A clock, at the resolution the phrases above need.
 *
 * Per-component and disposed with it, like the note's expansion state: nothing
 * about it belongs to the document, and a timer that outlived the pill would be
 * a timer nobody stops.
 */
export const createNow = (): Accessor<number> => {
  const [now, setNow] = createSignal(Date.now())
  const timer = setInterval(() => setNow(Date.now()), TICK)
  onCleanup(() => clearInterval(timer))
  return now
}
