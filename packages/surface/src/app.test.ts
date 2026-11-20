import { expect, test } from "bun:test"
import { Schema } from "effect"

import { App, appName } from "./app.ts"

test("the app names itself with the machine in brackets", () => {
  expect(appName("desk")).toBe("olai [desk]")
})

test("App requires the box and a start instant, as strings", () => {
  expect(Schema.is(App)({
    hostname: "desk",
    startedAt: "2026-08-29T09:31:00.000Z",
  })).toBe(true)
  expect(Schema.is(App)({ hostname: "desk" })).toBe(false)
  expect(Schema.is(App)({ startedAt: "2026-08-29T09:31:00.000Z" })).toBe(false)
  expect(Schema.is(App)({ hostname: "desk", startedAt: "not a date" })).toBe(true)
})
