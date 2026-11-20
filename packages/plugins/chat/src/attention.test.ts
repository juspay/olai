import { describe, expect, test } from "bun:test"

import { unreadOf } from "./attention.ts"

const row = (said: string | null, seen: string | null) => ({
  said: said === null ? null : { text: "on it", at: said },
  seen,
})

const AT = "2026-09-01T16:41:00Z"
const LATER = "2026-09-01T16:44:00Z"

describe("whether there is something nobody has read", () => {
  test("a conversation that has said nothing is never unread, whoever has looked", () => {
    expect(unreadOf(row(null, null))).toBe(false)
    expect(unreadOf(row(null, AT))).toBe(false)
  })

  test("a line olai heard that nobody has acknowledged is unread", () => {
    expect(unreadOf(row(AT, null))).toBe(true)
  })

  test("a line whose own instant was acknowledged is read", () => {
    expect(unreadOf(row(AT, AT))).toBe(false)
  })

  test("a line said AFTER the acknowledgement is unread again", () => {
    expect(unreadOf(row(LATER, AT))).toBe(true)
  })

  test("only the line's OWN instant counts, so anything else leaves it unread", () => {
    expect(unreadOf(row(AT, LATER))).toBe(true)
    expect(unreadOf(row(AT, "not an instant at all"))).toBe(true)
  })
})
