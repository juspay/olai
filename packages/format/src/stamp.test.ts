import { expect, test } from "bun:test"

import { dayOf } from "./dates.ts"
import { outlineOf, STAMP_SHAPE } from "./fixtures.testlib.ts"
import { offsetOf, stampOf } from "./stamp.ts"

/** An instant with nothing round about it, so a stamp of it is legible in a
 *  failure whatever zone the suite is running in. */
const AT = new Date("2026-08-11T19:40:03Z")

// ── the offset ─────────────────────────────────────────────────────────

// The one thing here that can be wrong while the value still looks like a
// perfectly good date: `Date` reports the minutes to ADD to local time to
// reach UTC, and ISO writes the other sign. New York, Kolkata (which is also
// the half-hour case), and UTC itself.
test("the offset inverts the sign the platform reports", () => {
  expect(offsetOf(240)).toBe("-04:00")
  expect(offsetOf(-330)).toBe("+05:30")
  expect(offsetOf(0)).toBe("+00:00")
})

// ── the stamp ──────────────────────────────────────────────────────────

test("a stamp is an ISO datetime with seconds and a zone", () => {
  expect(stampOf(AT)).toMatch(STAMP_SHAPE)
})

// The local fields and the offset have to AGREE, which is exactly what a
// flipped sign breaks: read back, the text must name the instant it was made
// from. This is the test that fails in a zone that is not UTC when it does.
test("a stamp names the instant it was made from", () => {
  expect(new Date(stampOf(AT)).getTime()).toBe(AT.getTime())
})

// A stamp's day is the day where the person marking it is standing, which is
// the whole reason it is local: the day view and the calendar read the first
// ten characters (./dates.ts), and those are the local ones.
test("a stamp's day is the local day", () => {
  expect(dayOf(stampOf(AT))).toBe(
    `${AT.getFullYear()}-${String(AT.getMonth() + 1).padStart(2, "0")}-${
      String(AT.getDate()).padStart(2, "0")
    }`,
  )
})

// What this module writes, the one that reads dates has to accept — that pair
// is the reason a mint and a rule live in the same package. A record carrying
// a stamp parses, which is the format's own answer rather than a second
// opinion about ISO.
test("what a stamp writes, the format accepts", () => {
  const outline = outlineOf(
    `{"id":"order","ord":"a0","title":"order the new cabinets","done":${
      JSON.stringify(stampOf(AT))
    }}`,
  )
  expect(outline.nodes).toHaveLength(1)
})
