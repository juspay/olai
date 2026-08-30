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
 * THAT CLAIM GREW A SECOND HALF when a second thing started ticking. The
 * readouts in this client that are a reading of the wall clock — how long
 * ago the last commit was ({@link ./commit/ago.ts}), how long the running
 * tool call has been going ({@link ./chat/elapsed.ts}), how long the server
 * has been up ({@link ./uptime.ts}), how long a row's work has been going
 * ({@link ./live/duration/TookChip.tsx}) — go stale on their own, and each would
 * otherwise arrive with a `setInterval`, a signal and an `onCleanup` of its
 * own. Two copies is where a shape stops being incidental: what they have
 * in common is not the number but the LIFETIME, and a timer whose disposal
 * is written out per feature is a timer one feature will eventually forget
 * to stop. So {@link createTicking} is here, with the day, and
 * `claims.test.ts` holds the client to it — a further readout reaches for
 * this rather than typing the next `setInterval`.
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
 * ... AND ON THE WAY BACK TO THE PAGE, which is the same second half
 * {@link createToday} has and for the same reason — a reason this file already
 * calls "not belt-and-braces" and had, until this was written, been making only
 * about the day. Every browser there is throttles a hidden tab's timers to
 * minutes, so a tab left on a long build and come back to shows the number it
 * had when it was hidden, at exactly the moment somebody is looking at it. The
 * timer is for the tab on screen; the wake is for every tab that was not.
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
    const read = (): void => {
      setNow(Date.now())
    }
    read()
    const timer = setInterval(read, every)
    // Only on the way IN, like the day's: a tab being hidden is nobody reading
    // it, and a number that went stale for nobody can wait until there is
    // somebody. Inside the gate, so a shut conversation listens for nothing.
    const woke = (): void => {
      if (document.visibilityState === "visible") read()
    }
    document.addEventListener("visibilitychange", woke)
    onCleanup(() => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", woke)
    })
  })
  return now
}

/**
 * The TWO-SPEED clock two readouts wear, owned here for the reason above:
 * the second the uptime chip and the took chip grew one each, the
 * seconds-clock-until-a-border-then-a-minutes-one machinery existed twice —
 * one constant between them, twenty-five lines around it. What those lines
 * are is a LIFETIME again: a `setTimeout` aimed at the band's edge, aimed
 * and torn down with the component owning it.
 *
 * The shape both readouts need: a stamp that crossed the wire once
 * (`started`), a fine register under `coarsenAfter` of elapsed time and a
 * coarse one past it — `createTicking` takes a fixed interval, so the border
 * is a signal: when the span crosses it the seconds clock's gate closes and
 * the minute clock's opens. A stamp that is missing or not a time keeps
 * NEITHER — the same refusal {@link instantOf} hands every readout, which is
 * the half of the machinery that is not about pace at all.
 */
export const createTwoSpeed = (
  started: Accessor<string | number | undefined | null>,
  coarsenAfter: number,
): Accessor<number> => {
  const [coarse, setCoarse] = createSignal(false)
  const armed = (): boolean => instantOf(started()) !== null
  createEffect(() => {
    const then = instantOf(started())
    if (then === null) {
      setCoarse(false)
      return
    }
    const wait = coarsenAfter - Math.max(0, Date.now() - then)
    if (wait <= 0) {
      setCoarse(true)
      return
    }
    setCoarse(false)
    const handoff = setTimeout(() => setCoarse(true), wait)
    onCleanup(() => clearTimeout(handoff))
  })
  const fast = createTicking(SECOND, () => armed() && !coarse())
  const slow = createTicking(MINUTE, () => armed() && coarse())
  return () => (coarse() ? slow() : fast())
}

/**
 * SOMEBODY ELSE'S INSTANT, as a number this client can do arithmetic with — or
 * `null` when the text is not a time at all.
 *
 * Three readouts take a stamp minted somewhere else and say something relative
 * to it: how long ago the last commit was (out of a git repository), when a
 * stored conversation was last touched (out of the agent's session list), and
 * how long a tool call has been running (out of the chat transcript). None of
 * those strings is this app's to trust, and all three had spelled the same
 * two lines for themselves — a parse and a `Number.isNaN` — with a comment in
 * the newest of them asserting that it made "the same refusal" as the others.
 * A comment asserting agreement is what `./live.ts` says this client stopped
 * accepting.
 *
 * What is NOT shared is what each of them says instead, and that is right: the
 * pill draws nothing, the picker draws no stamp, the tool row draws no
 * duration. One rule about the TEXT, three answers about the drawing.
 *
 * `null` for a missing stamp as well as a malformed one, checked rather than
 * left to the parse — `new Date(null)` is the epoch, not an invalid date, so a
 * session with no `updatedAt` would otherwise be drawn as 1970.
 *
 * A STAMP THAT IS ALREADY A NUMBER passes straight through, and that is this
 * function doing its ONE job over one more encoding rather than two jobs. A
 * fourth readout arrived carrying `Date.now()` off the wire (the CI chip's
 * running node — odu stamps in milliseconds, not ISO), and the alternative was
 * for it to spell the instant into text so this could parse it back: a value
 * laundered through a string to satisfy a signature, on every read. The
 * question this answers is "what number is that instant"; an instant that is
 * already the number is the identity case of it.
 */
export const instantOf = (
  at: string | number | null | undefined,
): number | null => {
  if (at === null || at === undefined) return null
  if (typeof at === "number") return Number.isFinite(at) ? at : null
  const then = Date.parse(at)
  return Number.isNaN(then) ? null : then
}

/** Milliseconds, in the units the readouts above are written in. Here rather
 *  than privately in each of them, for the reason the timer is: the two files
 *  that draw a duration are the two this one already pairs, and each derived
 *  its own tick from its own copy of the same ladder. */
export const SECOND = 1_000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
