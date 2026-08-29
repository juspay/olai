/**
 * The one piece of the uptime chip that is arithmetic rather than markup.
 *
 * The wire value is an instant: the same start, a later `now`, is a longer
 * phrase — the local tick. `now` being an argument is what makes that a
 * table rather than an hour of waiting. The wiring — when this tab asks,
 * and that a retired wire does not re-ask — is `./named.test.ts`.
 */

import { describe, expect, test } from "bun:test"

import { sinceOf, stillSeconds, upOf } from "./uptime.ts"

const at = (iso: string): number => Date.parse(iso)

describe("how long the server has been up", () => {
  const started = "2026-08-29T09:31:00.000Z"

  test("the wire value once, the client ticks: the same start, a later now, is a longer up", () => {
    // Seconds while seconds are the question — a process that just came
    // back, which is the whole of the signal a restart leaves.
    expect(upOf(started, at("2026-08-29T09:31:12.000Z"))).toBe("up 12s")
    expect(upOf(started, at("2026-08-29T09:31:47.900Z"))).toBe("up 47s")
    // Then minutes, hours, days — furniture, coarse, the committed pill's
    // voice. The last digit of the seconds is not the point past a minute.
    expect(upOf(started, at("2026-08-29T09:33:00.000Z"))).toBe("up 2m")
    expect(upOf(started, at("2026-08-29T11:31:00.000Z"))).toBe("up 2h")
    expect(upOf(started, at("2026-08-31T09:31:00.000Z"))).toBe("up 2d")
  })

  test("a later start, the same now, is a shorter up", () => {
    const now = at("2026-08-29T12:00:00.000Z")
    expect(upOf("2026-08-29T10:00:00.000Z", now)).toBe("up 2h")
    expect(upOf("2026-08-29T11:59:48.000Z", now)).toBe("up 12s")
  })

  test("seconds are the question only under a minute", () => {
    expect(stillSeconds(started, at("2026-08-29T09:31:12.000Z"))).toBe(true)
    expect(stillSeconds(started, at("2026-08-29T09:31:59.999Z"))).toBe(true)
    expect(stillSeconds(started, at("2026-08-29T09:32:00.000Z"))).toBe(false)
  })

  test("a stamp from the future is up 0s, never a negative", () => {
    expect(upOf("2026-08-29T12:05:00.000Z", at("2026-08-29T12:00:00.000Z"))).toBe(
      "up 0s",
    )
  })

  test("something that is not a date says nothing at all", () => {
    expect(upOf("", at("2026-08-29T12:00:00.000Z"))).toBe("")
    expect(upOf("not a date", at("2026-08-29T12:00:00.000Z"))).toBe("")
  })
})

describe("the hover", () => {
  test("carries the exact start instant the wire sent", () => {
    expect(sinceOf("2026-08-29T09:31:00.000Z")).toBe(
      "up since 2026-08-29T09:31:00.000Z",
    )
  })

  test("a stamp that is not a time is not a sentence either", () => {
    expect(sinceOf("")).toBe("")
    expect(sinceOf("not a date")).toBe("")
  })
})
