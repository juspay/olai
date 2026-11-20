import { UsageFailure } from "@olai/format"
import type { Anchor } from "@olai/surface"
import { expect, test } from "bun:test"

import {
  after,
  before,
  commitOf,
  type Draft,
  type Editing,
  emptyPending,
  emptyPendingOf,
  besideOf,
  ghostOf,
  kept,
  landed,
  parked,
  type Pending,
  reaimed,
  refused,
  sameAnchor,
  sameSlot,
  seatKept,
  slotOf,
  stillAt,
  typed,
  walked,
} from "./draft.ts"

const editing = (over: Partial<Editing> = {}): Editing => ({
  kind: "row",
  row: "order",
  id: "order",
  place: "/kitchen/order",
  field: "title",
  text: "order the cabinets",
  saved: "order the cabinets",
  ...over,
})

const pending = (over: Partial<Pending> = {}): Pending => ({
  kind: "new",
  at: { kind: "after", id: "order" },
  text: "",
  slot: "d1",
  ...over,
})

test("a row nobody changed asks for nothing", () => {
  expect(commitOf(editing())).toBeNull()
})

test("a changed title is a retitle", () => {
  expect(commitOf(editing({ text: "order the new cabinets" })))
    .toEqual({ verb: "title", id: "order", title: "order the new cabinets" })
})

test("an emptied title is still asked for, so the refusal can be seen", () => {
  expect(commitOf(editing({ text: "" })))
    .toEqual({ verb: "title", id: "order", title: "" })
})

test("a note is written, and an emptied one is removed", () => {
  const note = editing({ field: "desc", text: "oak", saved: "" })
  expect(commitOf(note)).toEqual({ verb: "desc", id: "order", desc: "oak" })
  expect(commitOf({ ...note, text: "", saved: "oak" }))
    .toEqual({ verb: "desc", id: "order", desc: null })
})

test("a text edit names the node the row SHOWS, not the row", () => {
  expect(commitOf(editing({ row: "echo", id: "order", text: "changed" })))
    .toEqual({ verb: "title", id: "order", title: "changed" })
})

test("an empty new row is not a node", () => {
  expect(commitOf(pending())).toBeNull()
  expect(commitOf(pending({ text: "   " }))).toBeNull()
  expect(commitOf(pending({ text: "measure the alcove" })))
    .toEqual({
      verb: "add",
      at: { kind: "after", id: "order" },
      title: "measure the alcove",
    })
})

test("an empty pending is the three fields a new row starts with", () => {
  expect(emptyPending({ kind: "before", id: "kitchen" }, "d2")).toEqual({
    kind: "new",
    at: { kind: "before", id: "kitchen" },
    text: "",
    slot: "d2",
  })
})

test("only a pending with nothing in it is empty", () => {
  const blank = emptyPending({ kind: "after", id: "order" }, "d3")
  expect(emptyPendingOf(blank)).toEqual(blank)
  expect(emptyPendingOf(pending({ text: "   " }))).toEqual(pending({ text: "   " }))
  expect(emptyPendingOf(pending({ text: "measure" }))).toBeNull()
  expect(emptyPendingOf(editing({ text: "" }))).toBeNull()
  expect(emptyPendingOf(null)).toBeNull()
})

test("parking an empty pending puts it on the list once", () => {
  const blank = emptyPending({ kind: "before", id: "kitchen" }, "d1")
  const once = parked([], blank)
  expect(once).toEqual([blank])
  expect(parked(once, blank)).toBe(once)
  expect(parked([], editing())).toEqual([])
  expect(parked([], pending({ text: "measure" }))).toEqual([])
  expect(parked([], null)).toEqual([])
})

test("a titled before-draft re-aims the parked ones onto the row it became", () => {
  const d1 = emptyPending({ kind: "before", id: "kitchen" }, "d1")
  const d2 = emptyPending({ kind: "before", id: "kitchen" }, "d2")
  const next = reaimed([d1, d2], d2.at, "garage")
  expect(next).toEqual([
    { ...d1, at: { kind: "before", id: "garage" } },
    { ...d2, at: { kind: "before", id: "garage" } },
  ])
  expect(reaimed(next, d2.at, "other")).toEqual(next)
})

test("a first or under draft re-aims the skeleton onto the row it became", () => {
  const first = emptyPending({ kind: "first", file: "empty.olai" }, "d1")
  expect(reaimed([first], first.at, "n1")).toEqual([
    { ...first, at: { kind: "before", id: "n1" } },
  ])
  const under = emptyPending({ kind: "under", id: "knobs" }, "d2")
  expect(reaimed([under], under.at, "n2")).toEqual([
    { ...under, at: { kind: "before", id: "n2" } },
  ])
})

test("an after-draft leaves the parked ones on their neighbour", () => {
  const d1 = emptyPending({ kind: "after", id: "handles" }, "d1")
  expect(reaimed([d1], d1.at, "n7")).toEqual([d1])
})

test("typing changes the text, and drops what the last write said", () => {
  const said = refused(editing(), new UsageFailure({ reason: "a node needs a title" }))
  const next = typed(said, "half a t")
  expect(next.text).toBe("half a t")
  expect(next.refused).toBeUndefined()
})

test("a commit that landed is a draft with nothing left to say", () => {
  const done = landed(editing({ text: "changed" }), "order")
  expect(done.saved).toBe("changed")
  expect(commitOf(done)).toBeNull()
})

test("a landed commit carries the nudge the write came back with", () => {
  expect(landed(editing({ text: "x" }), "order", "every task under it is done now").nudge)
    .toBe("every task under it is done now")
})

test("a cancelled draft stays cancelled when the write lands", () => {
  const held = editing()
  expect(kept(null, held, "placed")).toBeNull()
})

test("the same draft keeps the write's nudge", () => {
  const held = editing()
  expect(kept(held, held, "placed")).toEqual({ ...held, nudge: "placed" })
})

test("a different draft is left alone", () => {
  const held = editing()
  const other = editing({ row: "knobs", id: "knobs", text: "pick the knobs" })
  expect(kept(other, held, "placed")).toBe(other)
})

test("a new row that landed becomes the row it created", () => {
  expect(landed(pending({ text: "measure" }), "n7")).toEqual({
    kind: "row",
    row: "n7",
    id: "n7",
    place: null,
    field: "title",
    text: "measure",
    saved: "measure",
    was: { row: "d1", field: "new" },
  })
})

test("a landed line is the same ghost at the same address", () => {
  const line = pending({ text: "measure the alcove" })
  expect(ghostOf(line)).toEqual({ draft: line, slot: "d1" })
  const landedLine = landed(line, "n7")
  expect(ghostOf(landedLine)).toEqual({ draft: landedLine, slot: "d1" })
  expect(ghostOf(landedLine)!.draft).toBe(landedLine)
})

test("a row with a place of its own is not a ghost", () => {
  const drawn = landed(pending({ text: "measure" }), "n7")
  expect(ghostOf({ ...drawn, place: "/kitchen/measure" })).toBeNull()
  expect(ghostOf(editing())).toBeNull()
  expect(ghostOf(null)).toBeNull()
})

test("an editor a key opened on a row it has not drawn yet is not a ghost", () => {
  expect(ghostOf({
    kind: "row",
    row: "n7",
    id: "n7",
    place: null,
    field: "title",
    text: " the handles",
    saved: " the handles",
  })).toBeNull()
})

test("a landed row is drawn at the seat the write recorded", () => {
  expect(seatKept("n7", new Map<string, Anchor>([["n7", { kind: "before", id: "kitchen" }]])))
    .toEqual({ kind: "before", id: "kitchen" })
})

test("the keep-walk goes back through a chain, and past a row that IS drawn", () => {
  expect(seatKept("n8", new Map<string, Anchor>([
    ["n8", { kind: "after", id: "n7" }],
    ["n7", { kind: "under", id: "kitchen" }],
  ]))).toEqual({ kind: "under", id: "kitchen" })
  expect(seatKept("n7", new Map<string, Anchor>([["n7", { kind: "before", id: "kitchen" }]])))
    .toEqual({ kind: "before", id: "kitchen" })
  expect(seatKept("n7", new Map())).toBeNull()
})

test("a page's start line is nobody's row, landed or not", () => {
  expect(besideOf({ kind: "first", file: "empty.olai" })).toBeNull()
  expect(besideOf(seatKept("n1", new Map<string, Anchor>([["n1", { kind: "first", file: "empty.olai" }]]))!))
    .toBeNull()
})

test("a placing that points back at itself is not a walk without end", () => {
  const loop = new Map<string, Anchor>([["n7", { kind: "after", id: "n7" }]])
  expect(seatKept("n7", loop)).toEqual({ kind: "after", id: "n7" })
  expect(walked({ kind: "after", id: "n7" }, loop, new Set())).toEqual({ kind: "after", id: "n7" })
})

test("the find-walk stops at a row the page draws", () => {
  expect(walked(
    { kind: "after", id: "n7" },
    new Map<string, Anchor>([["n7", { kind: "before", id: "kitchen" }]]),
    new Set(["n7"]),
  )).toEqual({ kind: "after", id: "n7" })
})

test("the next row follows the ROW, not the node it shows", () => {
  expect(after(editing({ row: "echo", id: "order" })))
    .toEqual({ kind: "after", id: "echo" })
})

test("Enter at column 0 is before the ROW, not after its subtree", () => {
  expect(before(editing({ row: "echo", id: "order" })))
    .toEqual({ kind: "before", id: "echo" })
})

test("a pending next to a row is at its furniture — its under-seat too", () => {
  expect(besideOf({ kind: "after", id: "order" })).toEqual({ kind: "after", id: "order" })
  expect(besideOf({ kind: "before", id: "order" })).toEqual({ kind: "before", id: "order" })
  expect(besideOf({ kind: "under", id: "order" })).toEqual({ kind: "under", id: "order" })
  expect(besideOf({ kind: "first", file: "a.olai" })).toBeNull()
})

test("a slot names the box rather than the text in it", () => {
  const before = editing()
  const after = typed(before, "changed")
  expect(sameSlot(slotOf(before), slotOf(after))).toBe(true)
  expect(sameSlot(slotOf(before), slotOf(editing({ field: "desc" })))).toBe(false)
  expect(sameSlot(slotOf(before), slotOf(editing({ row: "demo" })))).toBe(false)
  expect(sameSlot(slotOf(before), slotOf(pending() as Draft))).toBe(false)
})

test("a new row is drawn after the row it follows, or on a page's start line", () => {
  expect(slotOf(pending())).toEqual({ row: "d1", field: "new" })
  expect(slotOf(pending({ slot: "d2", at: { kind: "first", file: "a.olai" } })))
    .toEqual({ row: "d2", field: "new" })
})

test("a line that landed is still the editor the blur came from", () => {
  const line = pending({ text: "measure the alcove" })
  const from = slotOf(line)
  const row = landed(line, "n7")
  expect(sameSlot(slotOf(row), from)).toBe(false)
  expect(stillAt(row, from)).toBe(true)
  expect(stillAt(editing({ row: "demo" }), from)).toBe(false)
  expect(stillAt(row, slotOf(pending({ slot: "d2", at: { kind: "after", id: "demo" } })))).toBe(false)
})

test("a row that was always a row forwards nothing", () => {
  const row = landed(pending({ text: "measure" }), "n7")
  expect(landed(typed(row, "measure the alcove"), "n7").was).toBeUndefined()
})

test("two anchors are the same place only when they name the same one", () => {
  expect(sameAnchor({ kind: "under", id: "order" }, { kind: "under", id: "order" }))
    .toBe(true)
  expect(sameAnchor({ kind: "under", id: "order" }, { kind: "after", id: "order" }))
    .toBe(false)
  expect(sameAnchor({ kind: "before", id: "order" }, { kind: "before", id: "order" }))
    .toBe(true)
  expect(sameAnchor({ kind: "before", id: "order" }, { kind: "after", id: "order" }))
    .toBe(false)
  expect(sameAnchor({ kind: "first", file: "a.olai" }, { kind: "first", file: "b.olai" }))
    .toBe(false)
})
