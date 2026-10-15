/**
 * THE WHOLE OF "UNREAD", in one predicate — the reason it is a predicate and
 * not a comparison each face makes for itself (`./attention.ts` argues it).
 *
 * The cases are the states a roster row can be in, and the interesting one is
 * the pair a FLAG could not tell apart: a line acknowledged and then superseded
 * by a later one is unread again, without anything having cleared a mark. That
 * is the whole reason the record keeps an instant.
 */

import { describe, expect, test } from "bun:test"

import { unreadOf } from "./attention.ts"

/** A roster row's half that this reads — the wire's own pair, spelled here so
 *  the cases read as conversations rather than as objects. */
const row = (said: string | null, seen: string | null) => ({
  said: said === null ? null : { text: "on it", at: said },
  seen,
})

const AT = "2026-09-01T16:41:00Z"
const LATER = "2026-09-01T16:44:00Z"

describe("whether there is something nobody has read", () => {
  test("a conversation that has said nothing is never unread, whoever has looked", () => {
    // The case the definition has to get right in the quiet direction: an open
    // conversation nobody has spoken in has nothing to have missed, and
    // `seen` is absent for it rather than missing.
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
    // Not "was it ever read" but "has it been read SINCE" — which is the one
    // question a flag could not answer and an instant can.
    expect(unreadOf(row(LATER, AT))).toBe(true)
  })

  test("only the line's OWN instant counts, so anything else leaves it unread", () => {
    // The predicate compares the two strings, and that is deliberate rather
    // than a comparison of instants: an acknowledgement that does not NAME
    // this line is not an acknowledgement of it, and the direction matters —
    // the mark stands where the two disagree, which can overstate what is
    // unread and can never understate it.
    expect(unreadOf(row(AT, LATER))).toBe(true)
    expect(unreadOf(row(AT, "not an instant at all"))).toBe(true)
  })
})
