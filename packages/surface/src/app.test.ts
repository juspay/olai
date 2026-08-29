import { expect, test } from "bun:test"
import { Schema } from "effect"

import { App, appName } from "./app.ts"

// The one shape every face of the app draws — brackets, because the word and
// the box are two things a reader must not confuse ("olai desk" reads as one
// long name; `olai [desk]` reads as the app, on desk).
test("the app names itself with the machine in brackets", () => {
  expect(appName("desk")).toBe("olai [desk]")
})

// Two process facts, both required: a hostname without a start is a chip
// that cannot tick, and a start without a hostname is a wordmark that
// cannot name the box. The start is an ISO instant, not a duration — the
// client ticks, the wire does not.
test("App requires the box and a start instant, as strings", () => {
  expect(Schema.is(App)({
    hostname: "desk",
    startedAt: "2026-08-29T09:31:00.000Z",
  })).toBe(true)
  expect(Schema.is(App)({ hostname: "desk" })).toBe(false)
  expect(Schema.is(App)({ startedAt: "2026-08-29T09:31:00.000Z" })).toBe(false)
  // Not an ISO check — `Schema.String` is the wire, and a stamp the
  // client cannot parse draws no chip rather than failing the landing.
  expect(Schema.is(App)({ hostname: "desk", startedAt: "not a date" })).toBe(true)
})
