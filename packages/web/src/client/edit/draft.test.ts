import { UsageFailure } from "@olai/format"
import { expect, test } from "bun:test"

import {
  after,
  anchorRow,
  commitOf,
  type Draft,
  type Editing,
  kept,
  landed,
  type Pending,
  refused,
  sameAnchor,
  sameSlot,
  slotOf,
  stillAt,
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
  expect(commitOf(note)).toEqual({ verb: "desc", id: "order", desc: "oak", was: null })
  expect(commitOf({ ...note, text: "", saved: "oak" }))
    .toEqual({ verb: "desc", id: "order", desc: null, was: "oak" })
})

test("a note's write is CONDITIONAL on what this editor last saved", () => {
  // Autosave writes a note while somebody is still in it, over and over, on a
  // pause (./autosave.ts) — so it may not be the write that loses somebody
  // else's words. `was` is what this editor last saved, and "there was no
  // note" is spelled `null` on both sides so the value and its condition
  // cannot drift apart.
  expect(commitOf(editing({ field: "desc", text: "oak, oiled", saved: "oak" })))
    .toEqual({ verb: "desc", id: "order", desc: "oak, oiled", was: "oak" })
})

test("a title's write is not conditional, because typing one means it", () => {
  // The asymmetry with the note above is deliberate: a title is one line, and
  // typing it means "the title is this now" — which is exactly what
  // `set_title` does for an agent. What is conditional there is an UNDO.
  expect(commitOf(editing({ text: "order the oak" })))
    .toEqual({ verb: "title", id: "order", title: "order the oak" })
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

test("a cancelled draft stays cancelled when the write lands", () => {
  // Escape is not queued. A completion's add_mirror can still be in flight
  // when the key lands, and putting `held` back is how the editor bounced
  // open after the draft had already closed (input_widgets.feature:209).
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
  // The caret stays in the line that was typed: same text, now a row, with the
  // id the set gave it — and no place yet, because the row it names is a frame
  // away from being drawn. The editor's `follow` is what fills that in. It also
  // keeps the address it was typed at, which is the one thing about it that
  // anything still holding this caret — a blur in flight — knows it by.
  expect(landed(pending({ text: "measure" }), "n7")).toEqual({
    kind: "row",
    row: "n7",
    id: "n7",
    place: null,
    field: "title",
    text: "measure",
    saved: "measure",
    was: { row: "order", field: "new" },
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

test("a new row is drawn after the row it follows, or on a page's start line", () => {
  // `after` is the only anchor a ROW draws — the other two are what a page
  // with no rows offers, and it draws them itself. So they have no row to be
  // drawn after, and saying so is what keeps one editor from appearing twice.
  expect(anchorRow({ kind: "after", id: "order" })).toBe("order")
  expect(anchorRow({ kind: "under", id: "order" })).toBeNull()
  expect(anchorRow({ kind: "first", file: "a.olai" })).toBeNull()
  expect(slotOf(pending())).toEqual({ row: "order", field: "new" })
  expect(slotOf(pending({ at: { kind: "first", file: "a.olai" } })))
    .toEqual({ row: null, field: "new" })
})

test("a line that landed is still the editor the blur came from", () => {
  // The bug this pair is here for: a blur commits before it closes, and
  // committing a BRAND-NEW line makes it the row it wrote — a slot at an id
  // that did not exist when the blur was delivered. Asked on slots alone the
  // editor read that as the reader having opened something else, so the click
  // away wrote the line and left the caret sitting in it.
  const line = pending({ text: "measure the alcove" })
  const from = slotOf(line)
  const row = landed(line, "n7")
  expect(sameSlot(slotOf(row), from)).toBe(false)
  expect(stillAt(row, from)).toBe(true)
  // And it is the forwarding address that says so, not a blanket yes: another
  // row's editor is another row's, landed or not.
  expect(stillAt(editing({ row: "demo" }), from)).toBe(false)
  expect(stillAt(row, slotOf(pending({ at: { kind: "after", id: "demo" } })))).toBe(false)
})

test("a row that was always a row forwards nothing", () => {
  // Only the one transition mints an address, so a row draft that commits
  // again does not go on answering to a slot it never had.
  const row = landed(pending({ text: "measure" }), "n7")
  expect(landed(typed(row, "measure the alcove"), "n7").was).toBeUndefined()
})

test("two anchors are the same place only when they name the same one", () => {
  expect(sameAnchor({ kind: "under", id: "order" }, { kind: "under", id: "order" }))
    .toBe(true)
  expect(sameAnchor({ kind: "under", id: "order" }, { kind: "after", id: "order" }))
    .toBe(false)
  expect(sameAnchor({ kind: "first", file: "a.olai" }, { kind: "first", file: "b.olai" }))
    .toBe(false)
})
