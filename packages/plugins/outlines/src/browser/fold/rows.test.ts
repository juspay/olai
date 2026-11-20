import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, rowsOf, rowsUnder, type Row } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { foldIdOf, foldOf, foldsUnder } from "./rows.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
  `{"id":"install","parent":"kitchen","ord":"a0","title":"install the cabinets"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
  `{"id":"kitchen-herbs","parent":"kitchen","ord":"a1","mirror":"herbs"}`,
  `{"id":"also-herbs","parent":"kitchen","ord":"a2","mirror":"herbs"}`,
  `{"id":"nowhere","parent":"kitchen","ord":"a3","mirror":"gone"}`,
].join("\n")

const GARDEN = [
  `{"id":"garden","ord":"a0","title":"garden"}`,
  `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed"}`,
  `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}`,
].join("\n")

const derived = derive(TEST_CLAIMS,
  recordsOf(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })),
)

const house = rowsOf(derived, "house.olai")
const kitchen = house[0] as Row
const at = (row: Row, id: string): Row => {
  const found = row.children.find((child) => child.at.node.id === id)
  if (found === undefined) throw new Error(`no \`${id}\` under \`${row.at.node.id}\``)
  return found
}

test("a node folds by itself, in the file it is written in", () => {
  expect(foldOf(kitchen)).toEqual({ id: "kitchen", file: "house.olai" })
  expect(foldIdOf(at(kitchen, "install"))).toBe("install")
})

test("a mirror folds by what it SHOWS, in the file that node lives in", () => {
  expect(foldOf(at(kitchen, "kitchen-herbs"))).toEqual({
    id: "herbs",
    file: "garden.olai",
  })
})

test("a row that shows nothing folds by its own record", () => {
  expect(foldOf(at(kitchen, "nowhere"))).toEqual({
    id: "nowhere",
    file: "house.olai",
  })
})

test("collapse-all names every node under a row that has children, once", () => {
  expect(foldsUnder(kitchen)).toEqual([
    { id: "kitchen", file: "house.olai" },
    { id: "install", file: "house.olai" },
    { id: "herbs", file: "garden.olai" },
  ])
})

test("a leaf names nothing", () => {
  expect(foldsUnder(at(at(kitchen, "install"), "handles"))).toEqual([])
})

test("the fold of a row is the same zoomed in as it is on the page", () => {
  const zoomed = rowsUnder(derived, derived.byId.get("kitchen") as never, [])
  const there = zoomed.find((row) => row.at.node.id === "install") as Row
  const here = at(kitchen, "install")
  expect(there.key).not.toBe(here.key)
  expect(foldOf(there)).toEqual(foldOf(here))
})
