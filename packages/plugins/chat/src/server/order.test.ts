import { expect, test } from "bun:test"

import { inBundleOrder } from "./order.ts"

const ranked = (rows: ReadonlyArray<string>) => (plugin: string): number => {
  const at = rows.indexOf(plugin)
  return at === -1 ? rows.length : at
}

const ROWS = ["claude", "kolu", "odu"] as const
const rank = ranked(ROWS)
const named = (...names: ReadonlyArray<string>) => names.map((name) => ({ name }))
const order = (items: ReadonlyArray<{ readonly name: string }>) =>
  inBundleOrder(items, (one) => one.name, rank).map((one) => one.name)

test("two rows that registered back to front come back in the bundle's order", () => {
  expect(order(named("odu", "kolu"))).toEqual(["kolu", "odu"])
})

test("two rows that registered in the bundle's order are left alone", () => {
  expect(order(named("kolu", "odu"))).toEqual(["kolu", "odu"])
})

test("a plugin the bundle never named goes last, and the rows keep their order", () => {
  expect(order(named("stranger", "odu", "kolu"))).toEqual(["kolu", "odu", "stranger"])
})

test("rows the build ranks the same come back in the order they arrived", () => {
  expect(order(named("b-stranger", "a-stranger"))).toEqual(["b-stranger", "a-stranger"])
})

test("two registrations from one plugin stay together, in the order they were made", () => {
  expect(order([{ name: "odu" }, { name: "kolu" }, { name: "odu" }]))
    .toEqual(["kolu", "odu", "odu"])
})
