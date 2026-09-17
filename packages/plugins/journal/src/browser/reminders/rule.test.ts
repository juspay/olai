import { expect, test } from "bun:test"
import { remind } from "./rule.ts"

test("the whole daily rule, including switched-off days that remain unspent", () => {
  for (const day of ["", "2026-09-11"]) {
    for (const owed of [undefined, { overdue: 0, today: 0 }, { overdue: 2, today: 0 }, { overdue: 0, today: 3 }, { overdue: 2, today: 3 }]) {
      for (const said of [null, "2026-09-10", "2026-09-11"]) {
        for (const on of [false, true]) {
          const expected = day === "2026-09-11" && said !== day && on && owed !== undefined && (owed.overdue > 0 || owed.today > 0)
          expect(remind(day, owed, said, on)).toBe(expected)
        }
      }
    }
  }
  expect(remind("2026-09-11", { overdue: 1, today: 0 }, null, false)).toBe(false)
  expect(remind("2026-09-11", { overdue: 1, today: 0 }, null, true)).toBe(true)
})
