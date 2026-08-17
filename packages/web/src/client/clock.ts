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
 *
 * A TIMER ALONE DOES NOT KEEP THAT PROMISE, which is the second half of this
 * file. A laptop shut at eleven and opened at nine the next morning ran no
 * timers while it slept; a backgrounded tab has its timers throttled to
 * minutes by every browser there is. Either way the page comes back showing
 * yesterday, and it is showing it at exactly the moment somebody is looking.
 * So the day is re-read whenever the page becomes visible again, and the timer
 * is re-aimed from wherever the clock has actually got to. The two answer
 * different halves of the same promise and neither replaces the other: the
 * timer is for the tab left open ON SCREEN past midnight, the wake is for
 * every tab that was not.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"

import { isoDate } from "@olai/format"

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

  let timer: ReturnType<typeof setTimeout> | undefined

  /** Read the clock, say what it said, and aim the timer at midnight from
   *  where the clock ACTUALLY IS. Re-aimed rather than left alone, because the
   *  timer this replaces may be one a sleeping machine left hours late — and
   *  aimed HERE and nowhere else, so the rule the file argues for (the next
   *  midnight, computed, never 24 hours assumed) is written down once. */
  const reread = (): void => {
    const now = new Date()
    setToday(isoDayOf(now))
    clearTimeout(timer)
    timer = setTimeout(reread, untilMidnight(now))
  }

  // The first aim is the same call: there is no timer to clear yet, and
  // `clearTimeout(undefined)` is a no-op.
  reread()

  // Coming BACK to the page, which is the moment the answer is looked at. Only
  // on the way in: a tab being hidden is nobody reading it, and a day changed
  // for nobody can wait until there is somebody.
  const woke = (): void => {
    if (document.visibilityState === "visible") reread()
  }
  document.addEventListener("visibilitychange", woke)

  onCleanup(() => {
    clearTimeout(timer)
    document.removeEventListener("visibilitychange", woke)
  })

  return today
}
