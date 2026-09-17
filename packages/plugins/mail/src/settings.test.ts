import { expect, test } from "bun:test"
import { pollMillis } from "./settings.ts"
test("poll intervals require a positive whole duration within the timer bound", () => {
  expect(pollMillis("2m")).toBe(120_000)
  expect(pollMillis(" 500ms ")).toBe(500)
  expect(pollMillis("1h")).toBe(3_600_000)
  expect(pollMillis("2147483647ms")).toBe(2_147_483_647)
  for (const value of ["0s", "-1s", "1.5s", "200", "bad", "2147483648ms", "999999999999d"]) expect(pollMillis(value)).toBeUndefined()
})
