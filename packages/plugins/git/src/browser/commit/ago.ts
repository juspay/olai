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
 * Only the ticking half touches a clock, and what it ticks — like the units it
 * counts in and the parse it stands on — is `../clock.ts`'s, shared with the
 * panel's own duration readout.
 */

import type { Accessor } from "solid-js"

import { createTicking, DAY, HOUR, instantOf, MINUTE } from "@olai/web/client/clock.ts"

/**
 * `at` as a phrase relative to `now`.
 *
 * Coarse on purpose, and it gets coarser as it goes back: seconds matter for
 * something that just happened and nothing else does. A future stamp — a clock
 * that disagrees with the repository's, which happens across machines — reads
 * as "just now" rather than as a negative number.
 */
export const agoOf = (at: string, now: number): string => {
  const then = instantOf(at)
  if (then === null) return ""
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
 * The MACHINERY is `../clock.ts`'s now — a signal, an interval, a wake and the
 * cleanup that stops both, which this file used to spell for itself until the
 * chat panel needed the same lines at a different resolution. What stays here
 * is the only part that is about `agoOf`: how often the phrase has to be
 * re-read, which is a fact about the finest distinction it draws and about
 * nothing else. No gate, because the pill ticks for as long as it is on screen.
 */
export const createNow = (): Accessor<number> => createTicking(TICK)
