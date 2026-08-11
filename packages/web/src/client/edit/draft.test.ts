import { UsageFailure } from "@olai/format"
import { expect, test } from "bun:test"

import {
  after,
  anchorRow,
  commitOf,
  type Draft,
  type Editing,
  landed,
  type Pending,
  refused,
  sameSlot,
  slotOf,
  typed,
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
  ...over,
})

// ── what a commit asks for ─────────────────────────────────────────────

test("a row nobody changed asks for nothing", () => {
  // The rule the idle timer rides on: sitting in a row is not a write, and a
  // write is a git commit.
  expect(commitOf(editing())).toBeNull()
})

test("a changed title is a retitle", () => {
  expect(commitOf(editing({ text: "order the new cabinets" })))
    .toEqual({ verb: "title", id: "order", title: "order the new cabinets" })
})

test("an emptied title is still asked for, so the refusal can be seen", () => {
  // Swallowing it here would leave a cleared row looking saved. The ops layer
  // is what says a node needs a title.
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
  // Typing in a mirror edits the node it stands for, which is what a mirror is
  // for — the two ids are what makes that expressible.
  expect(commitOf(editing({ row: "echo", id: "order", text: "changed" })))
    .toEqual({ verb: "title", id: "order", title: "changed" })
})

test("an empty new row is not a node", () => {
  // `Enter` pressed by accident writes nothing at all — which is why a new row
  // is a draft until it has a title rather than a blank record on disk.
  expect(commitOf(pending())).toBeNull()
  expect(commitOf(pending({ text: "   " }))).toBeNull()
  expect(commitOf(pending({ text: "measure the alcove" })))
    .toEqual({
      verb: "add",
      at: { kind: "after", id: "order" },
      title: "measure the alcove",
    })
})

// ── what a draft becomes ───────────────────────────────────────────────

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

test("a new row that landed becomes the row it created", () => {
  // The caret stays in the line that was typed: same text, now a row, with the
  // id the set gave it — and no place yet, because the row it names is a frame
  // away from being drawn. The editor's `follow` is what fills that in.
  expect(landed(pending({ text: "measure" }), "n7")).toEqual({
    kind: "row",
    row: "n7",
    id: "n7",
    place: null,
    field: "title",
    text: "measure",
    saved: "measure",
  })
})

test("the next row follows the ROW, not the node it shows", () => {
  // `Enter` on a mirror makes a sibling of the mirror — the line appears where
  // the reader is looking, rather than beside the node somewhere else.
  expect(after(editing({ row: "echo", id: "order" })))
    .toEqual({ kind: "after", id: "echo" })
})

// ── which editor a blur came from ──────────────────────────────────────

test("a slot names the box rather than the text in it", () => {
  // Two drafts one keystroke apart are the same slot, which is what lets a
  // blur that arrives late be told from one that is about another row.
  const before = editing()
  const after = typed(before, "changed")
  expect(sameSlot(slotOf(before), slotOf(after))).toBe(true)
  expect(sameSlot(slotOf(before), slotOf(editing({ field: "desc" })))).toBe(false)
  expect(sameSlot(slotOf(before), slotOf(editing({ row: "demo" })))).toBe(false)
  expect(sameSlot(slotOf(before), slotOf(pending() as Draft))).toBe(false)
})

test("a new row's slot is the row it is drawn after, and a page has one", () => {
  expect(slotOf(pending())).toEqual({ row: "order", field: "new" })
  expect(slotOf(pending({ at: { kind: "first", file: "a.jsonl" } })))
    .toEqual({ row: null, field: "new" })
  expect(anchorRow({ kind: "under", id: "order" })).toBe("order")
  expect(anchorRow({ kind: "first", file: "a.jsonl" })).toBeNull()
})
