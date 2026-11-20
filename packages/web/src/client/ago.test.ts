import { describe, expect, test } from "bun:test"

import { agoOf } from "./ago.ts"

const at = (iso: string): number => Date.parse(iso)

describe("how long ago", () => {
  const now = at("2026-08-10T12:00:00Z")

  test("gets coarser as it goes back", () => {
    expect(agoOf("2026-08-10T11:59:30Z", now)).toBe("just now")
    expect(agoOf("2026-08-10T11:48:00Z", now)).toBe("12m ago")
    expect(agoOf("2026-08-10T09:00:00Z", now)).toBe("3h ago")
    expect(agoOf("2026-08-07T12:00:00Z", now)).toBe("3d ago")
  })

  test("a stamp from the future is just now, never a negative", () => {
    expect(agoOf("2026-08-10T12:05:00Z", now)).toBe("just now")
  })

  test("something that is not a date says nothing at all", () => {
    expect(agoOf("", now)).toBe("")
    expect(agoOf("not a date", now)).toBe("")
  })

  test("a millisecond stamp is read as itself", () => {
    expect(agoOf(now - 12 * 60_000, now)).toBe("12m ago")
    expect(agoOf(now + 60_000, now)).toBe("just now")
    expect(agoOf(Number.NaN, now)).toBe("")
  })
})
