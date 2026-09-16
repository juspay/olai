import { UsageFailure } from "@olai/format"
import type { Anchor } from "@olai/surface"
import { expect, test } from "bun:test"

import {
  after,
  before,
  besideOf,
  commitOf,
  type Draft,
  type Editing,
  emptyPending,
  emptyPendingOf,
  ghostOf,
  kept,
  landed,
  parked,
  type Pending,
  reaimed,
  refused,
  sameAnchor,
  sameSlot,
  seatOf,
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
  // Escape is not queued. A completion's outlines_mirror can still be in flight
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
    was: { row: "d1", field: "new" },
  })
})

// ── the line that is being typed, on either side of the reply ──────────

test("a line that landed is still the ghost it was typed in", () => {
  // The reply and the frame carrying the row arrive in either order, and the
  // ghost is what stands in for the row in between: same words, and — this is
  // the load-bearing half — the SLOT it was typed at, so the `<input>` a person
  // is typing in is not remounted (with the caret) the moment the save lands.
  const line = pending({ text: "measure the alcove" })
  expect(ghostOf(line)).toEqual(line)
  expect(ghostOf(landed(line, "n7"))).toEqual({
    kind: "new",
    at: { kind: "after", id: "n7" },
    text: "measure the alcove",
    slot: "d1",
    refused: undefined,
    nudge: undefined,
  })
})

test("a row with a place of its own is not a ghost", () => {
  // `follow` has filled the place in, so the row is on screen and the editor is
  // the row's own — a second line for it would be two.
  const drawn = landed(pending({ text: "measure" }), "n7")
  expect(ghostOf({ ...drawn, place: "/kitchen/measure" })).toBeNull()
  expect(ghostOf(editing())).toBeNull()
  expect(ghostOf(null)).toBeNull()
})

test("an editor a key opened on a row it has not drawn yet is not a ghost", () => {
  // A split and a merge open theirs on the row the write answered with
  // (`editing.tsx`'s `opening`), and carry no address they were typed at:
  // there is no box to keep, and nothing to draw a ghost from.
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

test("a line that landed is drawn at the seat its ghost had", () => {
  // `commit` records where a pending was TYPED, keyed by the row the write
  // made, and that record is the whole of how the line stays put: the row it
  // names is not drawn yet, so walking the placings is what says where the line
  // belongs — the same answer the pending itself gave a moment earlier.
  const line = ghostOf(landed(pending({ at: { kind: "before", id: "kitchen" }, text: "measure" }), "n7"))
  expect(line).not.toBeNull()
  expect(seatOf(
    line!,
    new Map<string, Anchor>([["n7", { kind: "before", id: "kitchen" }]]),
    new Set(["kitchen", "order"]),
  )).toEqual({ kind: "before", id: "kitchen" })
})

test("the walk goes back through a chain, and stops at a row that is drawn", () => {
  const line = ghostOf(landed(pending({ text: "measure" }), "n7"))!
  // Two writes over one line that has not been drawn leave two placings behind.
  expect(seatOf(
    { ...line, at: { kind: "after", id: "n8" } },
    new Map<string, Anchor>([
      ["n8", { kind: "after", id: "n7" }],
      ["n7", { kind: "under", id: "kitchen" }],
    ]),
    new Set(["kitchen", "order"]),
  )).toEqual({ kind: "under", id: "kitchen" })
  // ...and the frame that draws the row ends it: the placing has nothing left
  // to say, and `follow` fills the draft's place in the same flush.
  expect(seatOf(
    line,
    new Map<string, Anchor>([["n7", { kind: "before", id: "kitchen" }]]),
    new Set(["kitchen", "n7"]),
  )).toEqual({ kind: "after", id: "n7" })
})

test("a page's start line is nobody's row, landed or not", () => {
  // `first` has no row to sit beside, so a start line draws its own draft —
  // which is exactly the case `StartLine` matches its anchor for.
  const line = ghostOf(landed(
    pending({ at: { kind: "first", file: "empty.olai" }, text: "the first thing" }),
    "n1",
  ))
  expect(line).not.toBeNull()
  expect(seatOf(
    line!,
    new Map<string, Anchor>([["n1", { kind: "first", file: "empty.olai" }]]),
    new Set(["kitchen"]),
  )).toBeNull()
})

test("a placing that points back at itself is not a walk without end", () => {
  // A superseded write can leave a chain that closes on itself; the walk stops
  // rather than spinning, and the line is drawn against what it named.
  expect(walked(
    { kind: "after", id: "n7" },
    new Map<string, Anchor>([["n7", { kind: "after", id: "n7" }]]),
    new Set(),
  )).toEqual({ kind: "after", id: "n7" })
})

test("the next row follows the ROW, not the node it shows", () => {
  // `Enter` on a mirror makes a sibling of the mirror — the line appears where
  // the reader is looking, rather than beside the node somewhere else.
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
  // Untrue once, invisible from every write-side pin: the Tab's own seat at a
  // CHILDLESS row — an editor minted so that nothing on the page drew it.
  expect(besideOf({ kind: "under", id: "order" })).toEqual({ kind: "under", id: "order" })
  expect(besideOf({ kind: "first", file: "a.olai" })).toBeNull()
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
  // The blur slot is the pending's own `slot`, so two ghosts at the same
  // anchor stay two editors. `under` and `first` have no row to sit next to;
  // those are a page's start line.
  expect(slotOf(pending())).toEqual({ row: "d1", field: "new" })
  expect(slotOf(pending({ slot: "d2", at: { kind: "first", file: "a.olai" } })))
    .toEqual({ row: "d2", field: "new" })
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
  expect(stillAt(row, slotOf(pending({ slot: "d2", at: { kind: "after", id: "demo" } })))).toBe(false)
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
  expect(sameAnchor({ kind: "before", id: "order" }, { kind: "before", id: "order" }))
    .toBe(true)
  expect(sameAnchor({ kind: "before", id: "order" }, { kind: "after", id: "order" }))
    .toBe(false)
  expect(sameAnchor({ kind: "first", file: "a.olai" }, { kind: "first", file: "b.olai" }))
    .toBe(false)
})
