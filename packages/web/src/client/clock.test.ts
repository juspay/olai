import { afterEach, expect, setSystemTime, test } from "bun:test"
import { stampOf } from "@olai/format"
import { inZone } from "@olai/format/testlib"
import { createRoot } from "solid-js"

import { createToday, isoDayOf, untilMidnight } from "./clock.ts"

/** An instant built from LOCAL parts, which is what these two functions read.
 *  A UTC literal would make the suite pass or fail by the runner's time zone,
 *  which is the very confusion this module exists to keep out of the app. */
const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date => new Date(year, month - 1, day, hour, minute)

// Local, and zero-padded: the day a person wrote in a file is the day where
// they are, and `toISOString` would put a reader west of Greenwich on
// tomorrow's date all evening.
test("today is the local calendar day, as ISO text", () => {
  expect(isoDayOf(at(2026, 8, 9, 23, 59))).toBe("2026-08-09")
  expect(isoDayOf(at(2026, 8, 10, 0, 0))).toBe("2026-08-10")
  expect(isoDayOf(at(2026, 1, 5, 12, 0))).toBe("2026-01-05")
})

// Two functions in two packages turn an instant into date text, and they have
// to agree about where a local day ENDS: this one says which day `/today` is,
// and `@olai/format`'s `stampOf` says which day a mark that was just written
// lands on. Marking something done and not finding it on today's page is what
// a disagreement would look like, in a scenario neither file mentions — so the
// agreement is asserted rather than assumed.
// In NAMED zones, not the runner's: under a UTC lane local is UTC, so a writer
// that had dropped local time would agree with this clock about every day and
// the assertion would pass while promising nothing (`@olai/format`'s
// `fixtures.testlib`). One zone on each side of Greenwich, at the two ends of a
// day, is where the two can disagree — a minute before local midnight is
// already tomorrow in UTC for the west, and yesterday for the east.
test("today is the day a stamp written at that instant falls on", () => {
  for (const zone of ["America/New_York", "Asia/Kolkata"]) {
    inZone(zone, () => {
      for (const instant of [at(2026, 8, 9), at(2026, 8, 9, 23, 59), at(2026, 1, 5, 12)]) {
        // A day is the first ten characters of a date value (docs/format.md),
        // so "the stamp is on this day" is the stamp starting with it.
        expect(stampOf(instant).startsWith(isoDayOf(instant))).toBe(true)
      }
    })
  }
})

test("the wait is until the next local midnight, and lands past it", () => {
  const noon = at(2026, 8, 9, 12)
  expect(untilMidnight(noon)).toBe(12 * 60 * 60 * 1000 + 1)
  // Exactly midnight is a whole day's wait, not none: the day it is has just
  // been read, and the next one is 24 hours off.
  expect(untilMidnight(at(2026, 8, 9))).toBe(24 * 60 * 60 * 1000 + 1)
})

// The wait always crosses into a new day — never zero, never the same day
// back — which is what stops a timer that fires a hair early from spinning.
test("waiting that long always lands on the next day", () => {
  for (const hour of [0, 1, 12, 22, 23]) {
    const now = at(2026, 2, 28, hour, 30)
    const woken = new Date(now.getTime() + untilMidnight(now))
    expect(untilMidnight(now)).toBeGreaterThan(0)
    expect(isoDayOf(woken)).toBe("2026-03-01")
  }
})

// ── coming back to a page that was asleep ──────────────────────────────
//
// The timer is the easy half and the tests above are about the arithmetic it
// runs on. These are about the half a timer cannot do: a machine that slept
// through midnight ran no timer, and a backgrounded tab had its throttled to
// minutes — so the page comes back showing yesterday, at exactly the moment
// somebody is looking at it.

/** A `document` with nothing on it but the one event this file listens for,
 *  installed in the global the client reads, and returning only what a test
 *  drives it by. Enough to run the clock outside a browser, which is what makes
 *  the wake testable at all — everything else about it is a clock reading, and
 *  `setSystemTime` is how a machine is put to sleep in a unit test. */
const fakePage = () => {
  const listeners = new Set<EventListener>()
  let visibility = "visible"

  const went = (state: string): void => {
    visibility = state
    for (const listener of [...listeners]) listener(new Event("visibilitychange"))
  }

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      // A getter, as it is on the real thing: the clock asks AFTER the event,
      // and a field read at install time would answer for the wrong moment.
      get visibilityState() {
        return visibility
      },
      addEventListener: (type: string, listener: EventListener): void => {
        if (type === "visibilitychange") listeners.add(listener)
      },
      removeEventListener: (_type: string, listener: EventListener): void => {
        listeners.delete(listener)
      },
    },
  })

  return {
    /** The reader comes back to this tab. */
    show: (): void => went("visible"),
    /** They go somewhere else — another tab, another app. */
    hide: (): void => went("hidden"),
    /** How many listeners are still attached: what a teardown has to leave. */
    watching: (): number => listeners.size,
  }
}

afterEach(() => {
  setSystemTime()
  Reflect.deleteProperty(globalThis, "document")
})

/** The clock, in a root that can be torn down the way a component is. */
const running = (): { readonly today: () => string; readonly dispose: () => void } =>
  createRoot((dispose) => ({ today: createToday(), dispose }))

test("a laptop shut before midnight and opened after it wakes on the new day", () => {
  const page = fakePage()
  setSystemTime(at(2026, 8, 9, 23, 50))
  const clock = running()
  expect(clock.today()).toBe("2026-08-09")

  // Asleep for eight hours: no timer ran, and the one that was pending is
  // hours late. Nothing but the wake can move this.
  setSystemTime(at(2026, 8, 10, 7, 30))
  page.show()
  expect(clock.today()).toBe("2026-08-10")
  clock.dispose()
})

test("a tab being hidden past midnight does not re-read anything", () => {
  const page = fakePage()
  setSystemTime(at(2026, 8, 9, 23, 50))
  const clock = running()

  setSystemTime(at(2026, 8, 10, 7, 30))
  page.hide()
  // Nobody is reading a hidden tab, so there is nothing to be stale FOR: the
  // day it shows is settled on the way back in, which is the assertion above.
  expect(clock.today()).toBe("2026-08-09")
  clock.dispose()
})

test("the listener lives exactly as long as the clock", () => {
  const page = fakePage()
  const clock = running()
  expect(page.watching()).toBe(1)
  clock.dispose()
  expect(page.watching()).toBe(0)
})
