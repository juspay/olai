/**
 * HOW LONG AGO, in the Dock's own spelling.
 *
 * `@kolu/solid-dockrow` deliberately does not own a clock — the README says so
 * and gives the reason: a ticking `now` is ambient app state and its cadence is
 * the app's call. What the package DOES own is everything that is not the
 * clock: which of the three renderings a row gets (`recencyMode`), which
 * instant that rendering means (`displayRecencyAt`), the violet capsule and the
 * reserved track. So what is left here is one phrase.
 *
 * ## The cadence is a minute, and kolu's is a second
 *
 * kolu's Dock ticks the wait chip every second, because a terminal that has
 * been waiting on you for eleven seconds is a number a person watches climb.
 * This ticks every MINUTE, and that is a deliberate difference rather than a
 * shortfall: kolu's dock is a dozen rows a person is staring at, and this is an
 * outline where forty lanes can carry a terminal each — a per-second tick per
 * row is a re-render storm bought for a digit nobody is watching, in a document
 * somebody is reading. Under a minute the phrase says `<1m`, which is honest
 * about its own resolution.
 *
 * The arithmetic is PURE and takes `now`, so it is a table of cases in a unit
 * test rather than something you wait an hour to see — `../commit/ago.ts`'s
 * arrangement exactly, and the clock machinery under it is the same one
 * (`../clock.ts`).
 */

import type { Accessor } from "solid-js"

import { createTicking, DAY, HOUR, MINUTE } from "../clock.ts"

/**
 * `at` as the Dock spells it: `<1m`, `7m`, `3h`, `2d`.
 *
 * Short because the row reserves eight characters for it, and coarser as it
 * goes back for `agoOf`'s reason: seconds matter for something that just
 * happened and nothing else does. A future stamp — two machines whose clocks
 * disagree, which is ordinary — reads as `<1m` rather than as a negative
 * number. `null` is a terminal padi has never seen activity in, and the row
 * draws nothing rather than a zero.
 */
export const recencyText = (at: number | null, now: number): string => {
  if (at === null) return ""
  const since = now - at
  if (since < MINUTE) return "<1m"
  if (since < HOUR) return `${Math.floor(since / MINUTE)}m`
  if (since < DAY) return `${Math.floor(since / HOUR)}h`
  return `${Math.floor(since / DAY)}d`
}

/** A clock at the resolution the phrase above needs — see the header on why it
 *  is a minute and not a second. */
export const createRecencyNow = (): Accessor<number> => createTicking(MINUTE)
