import { expect, test } from "bun:test"

import { headerOf } from "./header.ts"

const facts = (line: string): ReadonlyArray<unknown> | null => {
  const one = headerOf(line)
  return one === null ? null : [one.date, one.secondaryDate, one.status, one.payee, one.note]
}

test("a header is read through every spelling it has", () => {
  expect([facts("2026/1/5=2026-01-06 ! Lunch"), facts("2026.2.28 Dinner")]).toEqual([
    ["2026-01-05", "2026-01-06", "pending", "Lunch", null],
    ["2026-02-28", null, "unmarked", "Dinner", null],
  ])
})

test("a header carries its mark, code, description, comment and tags", () => {
  const one = headerOf("2026-01-05 * (INV-1) Grocery Store | weekly shop  ; trip:berlin, paid:true")
  expect(one).toEqual({
    date: "2026-01-05",
    secondaryDate: null,
    status: "cleared",
    code: "INV-1",
    description: "Grocery Store | weekly shop",
    payee: "Grocery Store",
    note: "weekly shop",
    comment: "trip:berlin, paid:true",
    tags: [
      { key: "trip", value: "berlin" },
      { key: "paid", value: "true" },
    ],
  })
})

test("an impossible day, an impossible secondary date and a glued word are not headers", () => {
  expect(headerOf("2024-02-31 nothing happens")).toBeNull()
  expect(headerOf("2026-01-01=2026-02-30 x")).toBeNull()
  expect(headerOf("2026-01-01x y")).toBeNull()
  expect(headerOf("account assets:bank")).toBeNull()
})
