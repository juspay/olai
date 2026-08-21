/**
 * The client's clocks: what day it is, and what time it is when something on
 * screen has to keep saying.
 *
 * The one clock in the client, and it sits at the top rather than inside
 * whichever feature happened to need it first: today is a fact about the TAB,
 * and its readers are the page model (`/today` names no date), the day page
 * and the month in the sidebar. Two of them asking a `Date` separately is two
 * answers that can differ by a day at exactly the wrong moment.
 *
 * THAT CLAIM GREW A SECOND HALF when a second thing started ticking. Two
 * readouts in this client are a reading of the wall clock and therefore go
 * stale on their own — how long ago the last commit was
 * ({@link ./commit/ago.ts}) and how long the running tool call has been going
 * ({@link ./chat/elapsed.ts}) — and each had arrived with a `setInterval`, a
 * signal and an `onCleanup` of its own. Two copies is where a shape stops being
 * incidental: what they have in common is not the number but the LIFETIME, and
 * a timer whose disposal is written out per feature is a timer one feature will
 * eventually forget to stop. So {@link createTicking} is here, with the day, and
 * `claims.test.ts` holds the client to it — a third readout reaches for this
 * rather than typing the fourth `setInterval`.
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

import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

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

/** A gate that is always open — what a readout that ticks for as long as it is
 *  on screen passes, spelled once rather than at each such call site. */
const ALWAYS: Accessor<boolean> = () => true

/**
 * A clock that re-reads itself every `every` milliseconds, for as long as
 * `when` says there is anything to time.
 *
 * WHAT IT IS FOR is a readout whose value is a reading of the wall clock: "12m
 * ago", "47s". Those go stale where they stand — the fact behind them has not
 * moved and the sentence about it has — so the signal moving is the whole of
 * how they stay true. The arithmetic is never here: each reader keeps its own
 * pure function of an instant and a `now`, which is what makes the interesting
 * cases a table instead of an hour of waiting.
 *
 * THE GATE is the half a bare interval cannot have. The chat panel's readout
 * exists only while a turn is in flight, and a timer under an idle conversation
 * would be waking the tab once a second to recompute nothing — worse, it would
 * be the machinery quietly disagreeing with the rule the readout itself follows
 * ({@link ./chat/elapsed.ts}: a dead conversation keeps no clock). Defaulted
 * open, because a readout that is simply on screen for as long as it is drawn
 * is the ordinary case and should not have to say so.
 *
 * The clock is READ AGAIN on the way in, not only on each tick: a gate that has
 * just opened is a fact that has just started, and starting from wherever the
 * last interval left the signal would date it to whenever the previous turn
 * ended.
 *
 * Per component and disposed with it. Nothing about a ticking readout belongs
 * to the document, and a timer that outlived the component that drew it would
 * be a timer nobody stops — which is the failure two hand-rolled copies of this
 * were each one edit away from.
 */
export const createTicking = (
  every: number,
  when: Accessor<boolean> = ALWAYS,
): Accessor<number> => {
  const [now, setNow] = createSignal(Date.now())
  createEffect(() => {
    if (!when()) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), every)
    onCleanup(() => clearInterval(timer))
  })
  return now
}
