import { expect, test } from "bun:test"
import { slotCatalog, slotContract } from "./slots.ts"

test("discovery describes only supplied owners and returns immutable copies", () => {
  const own = slotContract<string>("reader.details","plugin","the plugin's own details, as a string")
  expect(slotCatalog([])).toEqual([])
  expect(slotCatalog([{},null,{slots:{unrelated:"value"}}])).toEqual([])
  const catalog = slotCatalog([{slots:{details:own}}])
  expect(catalog).toEqual([{name:"reader.details",keyedBy:"plugin",handed:"the plugin's own details, as a string"}])
  expect(Object.isFrozen(catalog)).toBe(true)
  expect(Object.isFrozen(catalog[0])).toBe(true)
  expect(slotCatalog([])).toEqual([])
})

test("a descriptor that does not say what its face is handed is not a slot the catalog lists", () => {
  expect(slotCatalog([{slots:{bare:{name:"reader.bare",slotKey:"plugin"}}}])).toEqual([])
  expect(slotCatalog([{slots:{blank:{name:"reader.blank",slotKey:"plugin",handed:"  "}}}])).toEqual([])
})

test("a slot declared without its sentence is refused where it is declared, naming the slot", () => {
  expect(() => slotContract("reader.silent", "plugin", "")).toThrow(/reader\.silent/)
  expect(() => slotContract("reader.blank", "nothing", "   ")).toThrow(/reader\.blank/)
})
