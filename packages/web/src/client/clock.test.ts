import { afterEach, expect, setSystemTime, test } from "bun:test"
import { stampOf } from "@olai/format"
import { inZone } from "@olai/format/testlib"
import { createRoot } from "solid-js"

import { createToday, instantOf, isoDayOf, untilMidnight } from "./clock.ts"
const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date => new Date(year, month - 1, day, hour, minute)

test("today is the local calendar day, as ISO text", () => {
  expect(isoDayOf(at(2026, 8, 9, 23, 59))).toBe("2026-08-09")
  expect(isoDayOf(at(2026, 8, 10, 0, 0))).toBe("2026-08-10")
  expect(isoDayOf(at(2026, 1, 5, 12, 0))).toBe("2026-01-05")
})

test("today is the day a stamp written at that instant falls on", () => {
  for (const zone of ["America/New_York", "Asia/Kolkata"]) {
    inZone(zone, () => {
      for (const instant of [at(2026, 8, 9), at(2026, 8, 9, 23, 59), at(2026, 1, 5, 12)]) {
        expect(stampOf(instant).startsWith(isoDayOf(instant))).toBe(true)
      }
    })
  }
})

test("the wait is until the next local midnight, and lands past it", () => {
  const noon = at(2026, 8, 9, 12)
  expect(untilMidnight(noon)).toBe(12 * 60 * 60 * 1000 + 1)
  expect(untilMidnight(at(2026, 8, 9))).toBe(24 * 60 * 60 * 1000 + 1)
})

test("waiting that long always lands on the next day", () => {
  for (const hour of [0, 1, 12, 22, 23]) {
    const now = at(2026, 2, 28, hour, 30)
    const woken = new Date(now.getTime() + untilMidnight(now))
    expect(untilMidnight(now)).toBeGreaterThan(0)
    expect(isoDayOf(woken)).toBe("2026-03-01")
  }
})

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
    show: (): void => went("visible"),
    hide: (): void => went("hidden"),
    watching: (): number => listeners.size,
  }
}

afterEach(() => {
  setSystemTime()
  Reflect.deleteProperty(globalThis, "document")
})

const running = (): { readonly today: () => string; readonly dispose: () => void } =>
  createRoot((dispose) => ({ today: createToday(), dispose }))

test("a laptop shut before midnight and opened after it wakes on the new day", () => {
  const page = fakePage()
  setSystemTime(at(2026, 8, 9, 23, 50))
  const clock = running()
  expect(clock.today()).toBe("2026-08-09")

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

test("one stamp, two zones, one instant — the chip's arithmetic has no zone", () => {
  const stamp = "2026-08-29T17:47:00-04:00"
  const instant = Date.parse(stamp)
  inZone("America/New_York", () => {
    expect(instantOf(stamp)).toBe(instant)
  })
  inZone("Asia/Kolkata", () => {
    expect(instantOf(stamp)).toBe(instant)
  })
})

test("an instant that is already a number is the identity case, and a non-number is not one", () => {
  const stamp = "2026-08-29T17:47:00-04:00"
  const instant = Date.parse(stamp)
  expect(instantOf(instant)).toBe(instant)
  expect(instantOf(0)).toBe(0)
  expect(instantOf(-1_000)).toBe(-1_000)
  expect(instantOf(Number.NaN)).toBeNull()
  expect(instantOf(Number.POSITIVE_INFINITY)).toBeNull()
  expect(instantOf(null)).toBeNull()
  expect(instantOf(undefined)).toBeNull()
  expect(instantOf("not a time")).toBeNull()
})
