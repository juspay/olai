/**
 * What the palette may write, and about which node.
 *
 * The rows are the `•••` menu's own verbs (`../menu/verbs.ts` has that
 * suite), so what is checked here is the three decisions this file makes on
 * top of them: that a page which is not a zoom offers nothing, that every row
 * names the node the reader is looking at, and that the one verb with a
 * question of its own to ask carries it rather than sending on the first
 * press.
 */

import { derive, zoom } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { filterItems } from "./items.ts"
import { opItems } from "./ops.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","date":"2026-08-10"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
].join("\n")

const derived = derive(recordsOf(setOf({ "house.olai": HOUSE })))

/** The zoomed page for an id, narrowed to the arm that IS a node — which is
 *  the only arm App hands the palette. */
const at = (id: string) => {
  const zoomed = zoom(derived, id)
  if (zoomed.kind !== "node") throw new Error(`\`${id}\` is not a node page`)
  return zoomed
}

const labels = (id: string): ReadonlyArray<string> =>
  opItems(at(id), at(id).under).map((item) => item.label)

test("a page that is not a zoom offers no op rows at all", () => {
  // An outline, a day, the agenda, the trash — and the frame before the first
  // snapshot. A command aimed at a node the reader cannot see is a command
  // nobody can predict.
  expect(opItems(undefined, undefined)).toEqual([])
})

test("the zoomed node's own verbs, minus the one that opens a picker", () => {
  // `kitchen` is doing and carries no date, so: no `Mark doing`, no `Clear
  // date`. `Set date…` is absent for a different reason — it opens the ROW's
  // picker, and the palette is drawn over the tree rather than in it.
  expect(labels("kitchen")).toEqual([
    "Mark todo",
    "Complete",
    "Cancel",
    "Clear mark",
    "Duplicate",
    "Move to Trash",
  ])
  expect(labels("order")).toContain("Clear date")
})

test("every row says which node it is about, on the place line", () => {
  const rows = opItems(at("order"), at("order").under)
  expect(rows.every((row) => row.place === "on “order the cabinets”")).toBe(true)
  // The title is the WHOLE haystack — the filter already matches a row's own
  // label, so repeating it would search one word twice. What this adds is that
  // typing what you are looking at finds what you can do to it.
  expect(rows.every((row) => row.search === "order the cabinets")).toBe(true)
  expect(filterItems("cabinets", rows).length).toBe(rows.length)
  expect(filterItems("complete", rows).map((row) => row.label)).toEqual(["Complete"])
})

test("a row carries the edit it will send, and the archive carries its question", () => {
  const rows = opItems(at("install"), at("install").under)
  const complete = rows.find((row) => row.label === "Complete")
  expect(complete?.action).toEqual({
    kind: "edit",
    edit: { verb: "mark", id: "install", mark: "done" },
  })
  const trash = rows.find((row) => row.label === "Move to Trash")
  expect(trash?.action).toMatchObject({
    kind: "edit",
    edit: { verb: "trash", id: "install" },
  })
  // The MENU's sentence, verbatim — not a second wording of the same warning.
  expect(
    trash?.action.kind === "edit" ? trash.action.confirm : undefined,
  ).toContain("Move “install them” to the Trash?")
})

test("the ids are namespaced, so a shell row and an op row cannot collide", () => {
  expect(opItems(at("kitchen"), at("kitchen").under).map((row) => row.id))
    .toEqual([
      "op-mark-todo",
      "op-mark-done",
      "op-mark-cancelled",
      "op-clear-mark",
      "op-duplicate",
      "op-trash",
    ])
})

test("with no indexes yet the archive is not offered, rather than uncounted", () => {
  // The DUPLICATE is still there, and that is the difference between the two
  // verbs rather than an inconsistency: what a copy would make is decided
  // where the write is judged, so this one has no number to read off an index
  // it has not been given.
  expect(opItems(at("kitchen"), undefined).map((row) => row.label))
    .toEqual(["Mark todo", "Complete", "Cancel", "Clear mark", "Duplicate"])
})

test("the shelf's verb is not among them — the palette's pin row is the PAGE's", () => {
  // On a zoomed node the page IS that node, so keeping the menu's own pin here
  // would put two rows in the list doing one thing, and one of them would
  // quietly drop the `?q=`. The `•••` on a ROW goes on offering it.
  expect(labels("order")).not.toContain("Pin to sidebar")
  expect(labels("order")).not.toContain("Unpin from sidebar")
})
