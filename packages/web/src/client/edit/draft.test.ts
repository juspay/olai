import { expect, test } from "bun:test"

import {
  after,
  commitOf,
  type Draft,
  type Editing,
  landed,
  type Pending,
  sameSlot,
  slotOf,
  typed,
} from "./draft.ts"

const editing = (over: Partial<Editing> = {}): Editing => ({
  kind: "row",
  place: "/kitchen/order",
  id: "order",
  field: "title",
  text: "order the cabinets",
  saved: "order the cabinets",
  ...over,
})

const pending = (over: Partial<Pending> = {}): Pending => ({
  kind: "new",
  at: { kind: "after", id: "order" },
  place: "/kitchen/order",
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
    .toEqual({ verb: "retitle", id: "order", title: "order the new cabinets" })
})

test("an emptied title is still asked for, so the refusal can be seen", () => {
  // Swallowing it here would leave a cleared row looking saved. The ops layer
  // is what says a node needs a title.
  expect(commitOf(editing({ text: "" })))
    .toEqual({ verb: "retitle", id: "order", title: "" })
})

test("a note is written, and an emptied one is removed", () => {
  const note = editing({ field: "desc", text: "oak", saved: "" })
  expect(commitOf(note)).toEqual({ verb: "note", id: "order", desc: "oak" })
  expect(commitOf({ ...note, text: "", saved: "oak" }))
    .toEqual({ verb: "note", id: "order", desc: null })
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

test("typing changes only the text", () => {
  expect(typed(editing(), "half a t")).toEqual(editing({ text: "half a t" }))
})

test("a commit that landed is a draft with nothing left to say", () => {
  const done = landed(editing({ text: "changed" }), "order")
  expect(done.saved).toBe("changed")
  expect(commitOf(done)).toBeNull()
})

test("a new row that landed becomes the row it created", () => {
  // The caret stays in the line that was typed: same text, now a row, with the
  // id the set gave it.
  const done = landed(pending({ text: "measure" }), "n7")
  expect(done).toEqual({
    kind: "row",
    place: "/kitchen/n7",
    id: "n7",
    field: "title",
    text: "measure",
    saved: "measure",
  })
})

test("where a landed row is drawn is where its row will be", () => {
  // A key is the chain of ids from the root of the page: a sibling shares
  // everything but the last segment, a child appends one, and the first row of
  // an outline has nothing above it.
  expect(landed(pending({ text: "x" }), "n7").place).toBe("/kitchen/n7")
  expect(
    landed(pending({ text: "x", at: { kind: "under", id: "order" } }), "n7").place,
  ).toBe("/kitchen/order/n7")
  expect(
    landed(
      pending({ text: "x", at: { kind: "first", file: "a.jsonl" }, place: null }),
      "n7",
    ).place,
  ).toBe("/n7")
})

test("the next row follows the one just committed", () => {
  expect(after(editing())).toEqual({ kind: "after", id: "order" })
})

// ── which editor a blur came from ──────────────────────────────────────

test("a slot names the box rather than the text in it", () => {
  // Two drafts one keystroke apart are the same slot, which is what lets a
  // blur that arrives late be told from one that is about another row.
  const before = editing()
  const after = typed(before, "changed") as Editing
  expect(sameSlot(slotOf(before), slotOf(after))).toBe(true)
  expect(sameSlot(slotOf(before), slotOf(editing({ field: "desc" })))).toBe(false)
  expect(sameSlot(slotOf(before), slotOf(editing({ place: "/kitchen/demo" }))))
    .toBe(false)
  expect(sameSlot(slotOf(before), slotOf(pending() as Draft))).toBe(false)
})
