import { expect, test } from "bun:test"

import { agenda, day } from "./routes.ts"

test("journal owns the day address grammar", () => {
  expect(day.parse("/today")).toEqual({ today: true })
  expect(day.parse("/d/2026-09-04")).toEqual({ date: "2026-09-04" })
  expect(day.parse("/agenda")).toBeNull()
  expect(day.href({ today: true })).toBe("/today")
  expect(day.href({ date: "2026-09-04" })).toBe("/d/2026-09-04")
  expect(day.breadcrumb({ today: true })).toBe("Today")
  expect(day.breadcrumb({ date: "2026-09-04" })).toBe("2026-09-04")
  expect(day.request({ today: true }, "2026-09-04")).toEqual({
    kind: "day",
    date: "2026-09-04",
  })
})

test("journal owns the agenda address grammar", () => {
  expect(agenda.parse("/agenda")).toEqual({})
  expect(agenda.parse("/agenda/tomorrow")).toBeNull()
  expect(agenda.href({})).toBe("/agenda")
  expect(agenda.breadcrumb({})).toBe("Agenda")
  expect(agenda.request({}, "2026-09-04")).toEqual({
    kind: "agenda",
    today: "2026-09-04",
  })
})
