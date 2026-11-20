import { expect, test } from "bun:test"

import { dayOf } from "./occasion.ts"
import { inZone, outlineOf, STAMP_SHAPE } from "./fixtures.testlib.ts"
import { offsetOf, stampOf } from "./stamp.ts"
const AT = new Date("2026-08-11T19:40:03Z")

test("the offset inverts the sign the platform reports", () => {
  expect(offsetOf(240)).toBe("-04:00")
  expect(offsetOf(-330)).toBe("+05:30")
  expect(offsetOf(0)).toBe("+00:00")
})

test("a stamp is an ISO datetime with seconds and a zone", () => {
  expect(stampOf(AT)).toMatch(STAMP_SHAPE)
})

test("a stamp is written in the marker's zone, never in UTC", () => {
  inZone("Asia/Kolkata", () => {
    expect(stampOf(new Date("2026-08-11T19:40:03Z"))).toBe("2026-08-12T01:10:03+05:30")
  })
  inZone("America/New_York", () => {
    expect(stampOf(new Date("2026-08-11T19:40:03Z"))).toBe("2026-08-11T15:40:03-04:00")
  })
})

test("a stamp names the instant it was made from", () => {
  expect(new Date(stampOf(AT)).getTime()).toBe(AT.getTime())
})

test("a stamp's day is the local day", () => {
  expect(dayOf(stampOf(AT))).toBe(
    `${AT.getFullYear()}-${String(AT.getMonth() + 1).padStart(2, "0")}-${
      String(AT.getDate()).padStart(2, "0")
    }`,
  )
})

test("what a stamp writes, the format accepts", () => {
  const outline = outlineOf(
    `{"id":"order","ord":"a0","title":"order the new cabinets","done":${
      JSON.stringify(stampOf(AT))
    }}`,
  )
  expect(outline.nodes).toHaveLength(1)
})
