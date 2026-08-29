/**
 * The whole of the ⏱ chip that is arithmetic rather than markup: the two
 * ladders, and the boundary at which the tick stops being a digit a reader
 * is watching.
 *
 * `now` and the instants are arguments the way `./uptime.ts`'s are, so the
 * tables below are the cases rather than an hour of waiting: a settled span
 * never moves, and a running one moves in the two registers the mock rules
 * (`projects/olai/prototypes/timing-mock.html`) — `m:ss` under an hour, the
 * settled words past it.
 *
 * What is NOT here: whether there is a span to say at all. That is derived
 * with the set (@olai/format's `tookOf`, whose cases — the jump, the running
 * row, the instant-free settle — are its own test), and this file's ladders
 * are handed a number.
 */

import { describe, expect, test } from "bun:test"

import { DAY, HOUR, MINUTE, SECOND } from "./clock.ts"
import { exactOf, tickingOf, wordsOf } from "./took.ts"

describe("the settled words", () => {
  test("coarse, and coarser as the span grows", () => {
    // Seconds are the pomodoro's own unit: `47s`, not `0m`.
    expect(wordsOf(0)).toBe("0s")
    expect(wordsOf(47)).toBe("47s")
    expect(wordsOf(59)).toBe("59s")
    expect(wordsOf(60)).toBe("1m")
    expect(wordsOf(41 * 60)).toBe("41m")
    expect(wordsOf(59 * 60)).toBe("59m")
    // An hour keeps its minutes — the mock's `2h 34m`, counted and rounded.
    expect(wordsOf(HOUR / SECOND)).toBe("1h 0m")
    expect(wordsOf(9284)).toBe("2h 34m")
    expect(wordsOf((24 * HOUR + 3 * MINUTE) / SECOND)).toBe("1d 0h")
    expect(wordsOf((2 * 24 * HOUR + 5 * HOUR) / SECOND)).toBe("2d 5h")
  })

  test("a negative span is 0s, never a negative word", () => {
    expect(wordsOf(-61)).toBe("0s")
  })

  test("the hover says the exact figure, registers saying zero dropped", () => {
    expect(exactOf(0)).toBe("0s")
    expect(exactOf(47)).toBe("47s")
    expect(exactOf(60)).toBe("1m")
    expect(exactOf(61)).toBe("1m 1s")
    expect(exactOf(2460)).toBe("41m")
    expect(exactOf(9284)).toBe("2h 34m 44s")
    expect(exactOf(HOUR / SECOND)).toBe("1h")
    expect(exactOf(DAY / SECOND)).toBe("1d")
    expect(exactOf((2 * DAY + 5 * HOUR) / SECOND)).toBe("2d 5h")
    expect(exactOf((2 * DAY + 5 * HOUR + 3 * MINUTE) / SECOND + 4)).toBe("2d 5h 3m 4s")
  })
})

describe("the running register", () => {
  test("m:ss under an hour — pomodoro, ticking by the second", () => {
    expect(tickingOf(0)).toBe("0:00")
    expect(tickingOf(12 * SECOND)).toBe("0:12")
    expect(tickingOf(59 * SECOND + 999)).toBe("0:59")
    expect(tickingOf(47 * MINUTE + 12 * SECOND)).toBe("47:12")
    expect(tickingOf(HOUR - SECOND)).toBe("59:59")
  })

  test("and past the hour it puts the ticking digit down", () => {
    // The seconds stop being the point and stop being readable — the settled
    // words take over, which is also what the chip will SAY when the settle
    // lands: no register change at the boundary of the two.
    expect(tickingOf(HOUR)).toBe("1h 0m")
    expect(tickingOf(2 * HOUR + 34 * MINUTE)).toBe("2h 34m")
  })

  test("a start in the future is 0:00, never a negative counter", () => {
    expect(tickingOf(-30 * SECOND)).toBe("0:00")
  })
})
