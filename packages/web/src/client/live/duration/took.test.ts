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
 * row, the instant-free settle, the bank — are its own test), and this
 * file's ladders are handed a number. What IS here is that answer's
 * story-side half: `roundOf`, the one place the record's raw marks become
 * a round the story can tell — or none.
 */

import { describe, expect, test } from "bun:test"

import { DAY, HOUR, MINUTE, SECOND } from "../../clock.ts"
import {
  exactOf,
  liveOf,
  liveStoryOf,
  roundOf,
  settledStoryOf,
  tickingOf,
  wordsOf,
} from "./took.ts"

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

describe("the banked sum", () => {
  const AT = Date.parse("2026-08-29T09:50:00-04:00")

  test("bank plus live round — a re-started row reads the work, never the pause", () => {
    // Ten banked minutes from the first round, four minutes into the second:
    // the chip says 14m, and the 36-minute pause between the rounds is not
    // an operand.
    expect(liveOf(600, AT, AT + 4 * MINUTE)).toBe(600 * SECOND + 4 * MINUTE)
    // …and the sum is what the ticking register turns to words.
    expect(tickingOf(liveOf(600, AT, AT + 4 * MINUTE + 12 * SECOND))).toBe("14:12")
    expect(tickingOf(liveOf(2 * HOUR / SECOND + 12 * 60, AT, AT + 34 * MINUTE)))
      .toBe("2h 46m")
  })

  test("no bank is the single-round arithmetic, unchanged", () => {
    expect(liveOf(undefined, AT, AT + 47 * SECOND)).toBe(47 * SECOND)
    expect(liveOf(undefined, AT, AT)).toBe(0)
  })

  test("a start ahead of this clock spends none of the bank", () => {
    // The wire's instant out-running the browser is a skew to clamp, not a
    // debt the counted rounds should repay.
    expect(liveOf(600, AT, AT - 30 * SECOND)).toBe(600 * SECOND)
  })
})

describe("the live chip's story", () => {
  const AT = Date.parse("2026-08-29T09:50:00-04:00")
  const STARTED = "2026-08-29T09:50:00-04:00"

  test("a single round reads naturally — close to the tip's old words", () => {
    expect(liveStoryOf(undefined, STARTED, AT + 47 * SECOND))
      .toEqual(["round 1, under way since 2026-08-29T09:50:00-04:00"])
    // A bank of zero reads the same: a same-second round closed is no
    // earlier story to tell.
    expect(liveStoryOf(0, STARTED, AT + 47 * SECOND))
      .toEqual(["round 1, under way since 2026-08-29T09:50:00-04:00"])
  })

  test("a banked row enumerates the rounds the bank distinguishes, in order", () => {
    expect(liveStoryOf(600, STARTED, AT + 252 * SECOND)).toEqual([
      "10m already banked over the rounds before this one",
      "this round under way again since 2026-08-29T09:50:00-04:00 — 4m 12s so far",
      "14m 12s worked in all — the pauses between the rounds never counted",
    ])
  })

  // The bank's own rounding, the settle's: the tip claims the figure the
  // settle will bank, never the floor of it the face shows for one more
  // second.
  test("the live span rounds the way the bank does", () => {
    expect(liveStoryOf(600, STARTED, AT + (240 * SECOND + 700)))
      .toContain("this round under way again since 2026-08-29T09:50:00-04:00 — 4m 1s so far")
  })

  test("a start ahead of this clock reads an honest zero of it", () => {
    expect(liveStoryOf(600, STARTED, AT - 30 * SECOND)).toEqual([
      "10m already banked over the rounds before this one",
      "this round under way again since 2026-08-29T09:50:00-04:00 — 0s so far",
      "10m worked in all — the pauses between the rounds never counted",
    ])
  })

  // The chip's arm matched on a parseable start before this ran, so this is
  // belt for a hand-written record: the words, and no invented span.
  test("an unreadable instant is said, never subtracted", () => {
    expect(liveStoryOf(600, "next monday-ish", AT))
      .toEqual(["round 1, under way since next monday-ish"])
  })
})

describe("the round the record still windows", () => {
  const STARTED = "2026-08-29T09:52:00-04:00"
  const SETTLED = "2026-08-29T12:26:44-04:00"

  test("both ends read: the pair, and the span between them", () => {
    expect(roundOf(STARTED, SETTLED))
      .toEqual({ started: STARTED, settled: SETTLED, span: 9284 })
    // Ends out of order are the settle's own clamp: a real zero, never a
    // negative the bank could not have counted.
    expect(roundOf(SETTLED, STARTED))
      .toEqual({ started: SETTLED, settled: STARTED, span: 0 })
  })

  test("no round is said as no round — the three honest absences", () => {
    // The stamp was buried.
    expect(roundOf(undefined, SETTLED)).toBeUndefined()
    // The close was never an instant: work finished before olai stamped
    // anything settles to `true`, and never marked at all settles to
    // nothing.
    expect(roundOf(STARTED, true)).toBeUndefined()
    expect(roundOf(STARTED, undefined)).toBeUndefined()
    // A hand wrote one of the ends.
    expect(roundOf("tuesday-ish", SETTLED)).toBeUndefined()
  })
})

describe("the settled chip's story", () => {
  const STARTED = "2026-08-29T09:52:00-04:00"
  const SETTLED = "2026-08-29T12:26:44-04:00"
  // 2h 34m 44s between the two instants — roundOf's figure, handed in the
  // way the chip hands it.
  const ROUND = { started: STARTED, settled: SETTLED, span: 9284 }

  test("the single round: took, and the window that is also the wall", () => {
    expect(settledStoryOf({ took: 9284, banked: undefined, round: ROUND }))
      .toEqual([
        "took 2h 34m 44s — round 1: 2026-08-29T09:52:00-04:00 → 2026-08-29T12:26:44-04:00",
      ])
  })

  test("neither a bank nor a round says the figure and no more", () => {
    // A story the chip itself could never have drawn — its `took` derives
    // from exactly those two — but the function invents no window for it.
    expect(settledStoryOf({ took: 7, banked: undefined, round: undefined }))
      .toEqual(["took 7s"])
  })

  test("one banked round reads the same shape — the window answers the wall", () => {
    expect(settledStoryOf({ took: 9284, banked: 9284, round: ROUND }))
      .toEqual([
        "took 2h 34m 44s — the one round: 2026-08-29T09:52:00-04:00 → 2026-08-29T12:26:44-04:00",
      ])
  })

  test("several rounds split the bank from the windowed one, in order", () => {
    // `lane-lrd-address` of the roadmap vault, verbatim: the earlier rounds
    // closed 51m 23s into the bank, the last one windowed by the pair.
    expect(
      settledStoryOf({
        took: 4869,
        banked: 4869,
        round: {
          started: "2026-08-30T12:02:37-04:00",
          settled: "2026-08-30T12:32:23-04:00",
          span: 1786, // 29m 46s — and the lump is the remaining 51m 23s.
        },
      }),
    ).toEqual([
      "took 1h 21m 9s — the pauses between the rounds never counted",
      "the rounds before the last banked 51m 23s of it",
      "the last ran 29m 46s: 2026-08-30T12:02:37-04:00 → 2026-08-30T12:32:23-04:00",
    ])
  })

  test("a bank whose windows are all gone says the sum, never invents one", () => {
    // The stamp buried, or the close never an instant — either reading of
    // the record arrives here as the same `undefined` (roundOf's cases are
    // its own table above).
    expect(settledStoryOf({ took: 4869, banked: 4869, round: undefined }))
      .toEqual([
        "took 1h 21m 9s — rounds banked where each closed, the pauses between them never counted",
      ])
    // …but a hand-written ZERO bank with no window is even that claim shy of
    // what it can prove, so the tip holds to the one derived figure.
    expect(settledStoryOf({ took: 0, banked: 0, round: undefined }))
      .toEqual(["took 0s"])
  })

  // The windowed round outrunning the bank is a record a hand wrote: the
  // lump is floored at zero, so the tip reads as the one-round shape and
  // never a negative figure.
  test("a record whose window outruns its bank claims no lump", () => {
    expect(settledStoryOf({ took: 600, banked: 300, round: ROUND }))
      .toEqual([
        "took 10m — the one round: 2026-08-29T09:52:00-04:00 → 2026-08-29T12:26:44-04:00",
      ])
  })

  test("an honest zero is a story too", () => {
    expect(
      settledStoryOf({ took: 0, banked: 0, round: { started: STARTED, settled: STARTED, span: 0 } }),
    ).toEqual([
      "took 0s — the one round: 2026-08-29T09:52:00-04:00 → 2026-08-29T09:52:00-04:00",
    ])
  })
})
