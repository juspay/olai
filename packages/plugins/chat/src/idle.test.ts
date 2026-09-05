import { expect, test } from "bun:test"
import { idleMillis } from "./idle.ts"

test("node idle lifetime is optional and accepts positive whole milliseconds", () => {
  expect(idleMillis(undefined)).toBeUndefined()
  expect(idleMillis("")).toBeUndefined()
  expect(idleMillis("2000")).toBe(2000)
  expect(idleMillis("900000")).toBe(900000)
})

test("invalid node idle lifetimes fail explicitly instead of disabling the timer", () => {
  for (const value of ["0", "-1", "1.5", "Infinity", "NaN", "1000ms", " 1000", "2147483648", "9007199254740992"]) {
    expect(() => idleMillis(value)).toThrow("OLAI_CHAT_IDLE_MS must be an integer from 1 to 2147483647")
  }
})
