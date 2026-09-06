import { expect, test } from "bun:test"
import { slotCatalog, slotContract } from "./slots.ts"

test("discovery describes only supplied owners and returns immutable copies", () => {
  const own = slotContract<string>("reader.details","plugin")
  expect(slotCatalog([])).toEqual([])
  expect(slotCatalog([{},null,{slots:{unrelated:"value"}}])).toEqual([])
  const catalog = slotCatalog([{slots:{details:own}}])
  expect(catalog).toEqual([{name:"reader.details",keyedBy:"plugin"}])
  expect(Object.isFrozen(catalog)).toBe(true)
  expect(Object.isFrozen(catalog[0])).toBe(true)
  expect(slotCatalog([])).toEqual([])
})
