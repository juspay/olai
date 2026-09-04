/**
 * The picker's stamp: precise enough to tell two rows apart, and quiet about a
 * value that is not a time.
 *
 * The instants are built from LOCAL components and handed over as the ISO
 * strings an agent would send, so the suite asserts the same thing on a machine
 * in Bengaluru and one in CI: what a reader sees is their own clock's reading
 * of the moment the agent recorded.
 */

import { describe, expect, test } from "bun:test"

import { whenOf } from "./when.ts"

/** The ISO 8601 an agent sends for a given local moment. */
const iso = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string => new Date(year, month - 1, day, hour, minute).toISOString()

describe("when a conversation was last touched", () => {
  test("is the reader's own day and minute", () => {
    expect(whenOf(iso(2026, 8, 1, 17, 30))).toBe("2026-08-01 17:30")
  })

  test("pads, so the column lines up", () => {
    expect(whenOf(iso(2026, 1, 2, 3, 4))).toBe("2026-01-02 03:04")
  })

  test("tells two conversations of the same day apart", () => {
    // The `/clear` case, which is what this precision is for: two sessions
    // sharing a title, one of them superseded, and nothing else on the row
    // that differs.
    expect(whenOf(iso(2026, 8, 1, 17, 30))).not.toBe(whenOf(iso(2026, 8, 1, 17, 31)))
  })

  test("says nothing about a value that is not a time", () => {
    // `updatedAt` is the agent's string, and a picker printing "Invalid Date"
    // would be inventing a fact about a conversation.
    expect(whenOf("whenever")).toBe(null)
    expect(whenOf("")).toBe(null)
  })

  test("says nothing about a session the agent never stamped", () => {
    // `null` and not the epoch: `new Date(null)` is 1970, which is a date a
    // picker would draw with a straight face.
    expect(whenOf(null)).toBe(null)
  })
})
