/**
 * What day it is, in the reader's own time zone, kept true past midnight.
 *
 * The one clock in the client, and it sits at the top rather than inside
 * whichever feature happened to need it first: today is a fact about the TAB,
 * and its readers are the page model (`/today` names no date), the day page
 * and the month in the sidebar. Two of them asking a `Date` separately is two
 * answers that can differ by a day at exactly the wrong moment.
 *
 * LOCAL, deliberately. The dates in the files are what a person wrote down, so
 * the day they mean is the day where they are — `new Date().toISOString()`
 * would put a reader west of Greenwich on tomorrow's date all evening.
 *
 * And it MOVES. A tab left open overnight showing yesterday's ring, on a page
 * whose whole promise is that it follows the files without a reload, would be
 * the one stale thing on the screen. So the day is a signal, re-read at the
 * next local midnight — which is computed each time rather than assumed to be
 * 24 hours later, because the day a clock goes forward is not.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"

import { isoDate } from "./calendar/month.ts"

/** The local calendar day of an instant, as the ISO text the format stores. */
export const isoDayOf = (at: Date): string =>
  isoDate(at.getFullYear(), at.getMonth() + 1, at.getDate())

/** How long until the local day rolls over. A whole millisecond past midnight,
 *  so a timer that fires a hair early does not read the same day back and
 *  schedule itself again for zero. */
export const untilMidnight = (at: Date): number => {
  const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1)
  return midnight.getTime() - at.getTime() + 1
}

/** Today, as a signal that re-reads itself when the day changes. */
export const createToday = (): Accessor<string> => {
  const [today, setToday] = createSignal(isoDayOf(new Date()))

  let timer: ReturnType<typeof setTimeout>
  const wake = () => {
    const now = new Date()
    setToday(isoDayOf(now))
    timer = setTimeout(wake, untilMidnight(now))
  }
  timer = setTimeout(wake, untilMidnight(new Date()))
  onCleanup(() => clearTimeout(timer))

  return today
}
