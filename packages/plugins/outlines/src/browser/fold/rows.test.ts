/**
 * What a row folds BY — which is the whole of the 2026-08-13 ruling, as a
 * question about values: the node rather than the place, the node a row SHOWS
 * rather than the record standing there, and the file that node is DEFINED in
 * rather than the one being read.
 *
 * Over real derived rows rather than hand-built ones, because two of the three
 * answers are only interesting when a mirror is involved and a mirror is
 * exactly what a hand-built row would get to declare for itself.
 */

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

const derived = derive(
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
  // The ruling: one node, one fold state. The placement is `kitchen-herbs` in
  // house.olai and the fold is `herbs` in garden.olai, which is what makes
  // folding this row fold the node everywhere it appears.
  expect(foldOf(at(kitchen, "kitchen-herbs"))).toEqual({
    id: "herbs",
    file: "garden.olai",
  })
})

test("a row that shows nothing folds by its own record", () => {
  // A mirror whose target no node declares. It has no children, so nothing
  // ever asks — the answer exists so callers do not have to remember that.
  expect(foldOf(at(kitchen, "nowhere"))).toEqual({
    id: "nowhere",
    file: "house.olai",
  })
})

test("collapse-all names every node under a row that has children, once", () => {
  // `handles` is a leaf and is not in it: there is nothing for a fold to do.
  // `herbs` is mirrored TWICE under kitchen and is in it once, because one
  // node has one fold and naming it twice would be one write undoing itself.
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
  // The place key is not: the walk under a node seeds the chain with `""`, so
  // `install` is `/kitchen/install` on the outline and `/install` under the
  // zoom. Folding by node id is what makes a fold survive the round trip.
  const zoomed = rowsUnder(derived, derived.byId.get("kitchen") as never, [])
  const there = zoomed.find((row) => row.at.node.id === "install") as Row
  const here = at(kitchen, "install")
  expect(there.key).not.toBe(here.key)
  expect(foldOf(there)).toEqual(foldOf(here))
})
