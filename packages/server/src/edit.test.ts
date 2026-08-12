/**
 * What a keystroke turns into.
 *
 * Value in, value out — a snapshot and an intent, and the ops request they add
 * up to. No store, no socket and no browser, which is the whole reason
 * {@link ./edit.ts} is a pure function over a reading: the arithmetic of "the
 * row above this one" is exactly the part a keyboard editor gets wrong, and it
 * is answerable here with a fixture.
 *
 * The assertions are on the REQUEST rather than on the file it would produce.
 * What an `add` or a `move` does to the records is `@olai/ops`' own suite,
 * already written and not worth a second opinion; what is this layer's is
 * which request the key names.
 *
 * The second half is the same shape read backwards: what would TAKE a write
 * BACK, over the same fixture. An inverse is a value derived from a snapshot —
 * where a row sat, which mark it carried — so the arithmetic an undo gets
 * wrong is answerable here too, without a browser to press ⌘Z in.
 */

import { derive, type OpFailure, type OutlineSet } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import type { Reading, Request } from "@olai/ops"
import type { Edit } from "@olai/surface"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { inverseOf, requestFor } from "./edit.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-10","desc":"oak, or birch"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"pick the handles"}`,
  `{"id":"loose","ord":"a1","title":"a node with no children"}`,
  `{"id":"echo","ord":"a2","mirror":"order"}`,
].join("\n")

const reading = (set: OutlineSet = setOf({ "house.jsonl": HOUSE })): Reading => ({
  set,
  derived: derive(set.nodes),
})

/** The request, or a refusal quoted well enough to fix the test without a
 *  debugger. */
const asked = (edit: Edit, at: Reading = reading()): Request => {
  const outcome = requestFor(at, edit)
  if (Result.isFailure(outcome)) {
    throw new Error(
      `expected \`${edit.verb}\` to resolve, and it refused: ` +
        `${outcome.failure._tag} — ${outcome.failure.message}`,
    )
  }
  return outcome.success
}

const refused = (edit: Edit, at: Reading = reading()): OpFailure => {
  const outcome = requestFor(at, edit)
  if (Result.isSuccess(outcome)) {
    throw new Error(`expected \`${edit.verb}\` to be refused, and it resolved`)
  }
  return outcome.failure
}

// ── a new row ──────────────────────────────────────────────────────────

test("Enter under a parent adds a sibling in that parent", () => {
  expect(asked({ verb: "add", at: { kind: "after", id: "order" }, title: "measure" }))
    .toEqual({ op: "add", parent: "kitchen", after: "order", title: "measure" })
})

test("Enter on a top-level row names the FILE, because there is no parent", () => {
  expect(asked({ verb: "add", at: { kind: "after", id: "kitchen" }, title: "garage" }))
    .toEqual({ op: "add", file: "house.jsonl", after: "kitchen", title: "garage" })
})

test("the first child of a branch goes under it, last among nothing", () => {
  expect(asked({ verb: "add", at: { kind: "under", id: "loose" }, title: "a first" }))
    .toEqual({ op: "add", parent: "loose", title: "a first" })
})

test("the first row of an empty outline is the one place a file is named", () => {
  expect(asked({ verb: "add", at: { kind: "first", file: "new.jsonl" }, title: "one" }))
    .toEqual({ op: "add", file: "new.jsonl", title: "one" })
})

test("a new row after a MIRROR is a sibling of the mirror", () => {
  // Where the reader is looking, rather than beside the node the placement
  // stands for — which is somewhere else, in another parent, possibly in
  // another file. A mirror carries a parent and an `ord` like any record, so
  // there is nothing to resolve through.
  expect(asked({ verb: "add", at: { kind: "after", id: "echo" }, title: "x" }))
    .toEqual({ op: "add", file: "house.jsonl", after: "echo", title: "x" })
})

test("a new row after a node nothing declares is not found", () => {
  expect(refused({ verb: "add", at: { kind: "after", id: "ghost" }, title: "x" })._tag)
    .toBe("NotFoundFailure")
})

// ── the four moves ─────────────────────────────────────────────────────

test("Tab goes under the sibling above, last among its children", () => {
  expect(asked({ verb: "move", id: "install", how: "in" }))
    .toEqual({ op: "move", id: "install", parent: "order" })
})

test("Tab on the first of its siblings has nothing to go under", () => {
  const failure = refused({ verb: "move", id: "demo", how: "in" })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("no row above it")
})

test("Shift+Tab goes up a level, immediately after the old parent", () => {
  expect(asked({ verb: "move", id: "handles", how: "out" }))
    .toEqual({ op: "move", id: "handles", parent: "kitchen", after: "install" })
})

test("Shift+Tab one level down lands at top level, spelled `null`", () => {
  // `parent: null` is what a move means by "top level" — absent would mean
  // "leave the parent alone", which is a reorder rather than an outdent.
  expect(asked({ verb: "move", id: "demo", how: "out" }))
    .toEqual({ op: "move", id: "demo", parent: null, after: "kitchen" })
})

test("Shift+Tab at the top level is refused", () => {
  expect(refused({ verb: "move", id: "kitchen", how: "out" }).message)
    .toContain("already at the top level")
})

test("Alt+Shift+↑/↓ swaps with the sibling above or below", () => {
  expect(asked({ verb: "move", id: "order", how: "up" }))
    .toEqual({ op: "move", id: "order", before: "demo" })
  expect(asked({ verb: "move", id: "order", how: "down" }))
    .toEqual({ op: "move", id: "order", after: "install" })
})

test("there is nothing to move past at either end of a row", () => {
  expect(refused({ verb: "move", id: "demo", how: "up" })._tag).toBe("UsageFailure")
  expect(refused({ verb: "move", id: "install", how: "down" })._tag).toBe("UsageFailure")
})

test("indenting under a MIRROR names the node it shows", () => {
  // The one id this layer derives rather than receives, so it is the one that
  // has to be the id an agent would have named: a parent is a regular record,
  // and what hangs under a mirror on screen belongs to its target. Naming the
  // placement would be a request the ops layer always refuses — a keyboard
  // that cannot do what the equivalent `move_node` does.
  //
  // `later` is the row under `echo`, which mirrors `order`, so `Tab` on it is
  // "go under what that row shows".
  const set = setOf({
    "house.jsonl": `${HOUSE}\n{"id":"later","ord":"a3","title":"and one after it"}`,
  })
  expect(asked({ verb: "move", id: "later", how: "in" }, reading(set)))
    .toEqual({ op: "move", id: "later", parent: "order" })
})

test("indenting under a mirror of nothing is refused rather than doomed", () => {
  const set = setOf({
    "a.jsonl": [
      `{"id":"one","ord":"a0","title":"one"}`,
      `{"id":"ghost","ord":"a1","mirror":"nowhere"}`,
      `{"id":"two","ord":"a2","title":"two"}`,
    ].join("\n"),
  })
  expect(refused({ verb: "move", id: "two", how: "in" }, reading(set)).message)
    .toContain("not in the loaded set")
})

test("a MIRROR moves as itself — a placement is a row a reader can reorder", () => {
  // The opposite of a text edit, which the ops layer refuses on a mirror: the
  // mirror has no title of its own, but it does have a place among siblings.
  expect(asked({ verb: "move", id: "echo", how: "up" }))
    .toEqual({ op: "move", id: "echo", before: "loose" })
})

test("moving a row nothing declares is not found", () => {
  expect(refused({ verb: "move", id: "ghost", how: "up" })._tag).toBe("NotFoundFailure")
})

// ── the mark, and the text ─────────────────────────────────────────────

test("toggling reads the stored mark rather than being told it", () => {
  // Unmarked and `doing` both mean "put it on"; only the mark itself undoes.
  expect(asked({ verb: "toggle", id: "install", mark: "done" }))
    .toEqual({ op: "done", id: "install" })
  expect(asked({ verb: "toggle", id: "order", mark: "done" }))
    .toEqual({ op: "done", id: "order" })
  expect(asked({ verb: "toggle", id: "demo", mark: "done" }))
    .toEqual({ op: "done", id: "demo", undo: true })
})

test("an id the CALLER named travels as it is, mirror or not", () => {
  // The other half of the consistency rule. `set_done` on a mirror is refused
  // by the ops layer, naming the node to use instead — so `toggle` on one is
  // refused the same way, by the same layer, with the same sentence. Resolving
  // it HERE would make the keyboard succeed where the tool refuses, which is
  // the deviation read backwards. What keeps a person from meeting that
  // refusal is the client, which sends the id of the node a row SHOWS
  // (`web/src/client/edit/editing.tsx`, and the browser test that ticks a
  // mirror off).
  expect(asked({ verb: "toggle", id: "echo", mark: "done" }))
    .toEqual({ op: "done", id: "echo" })
})

test("a title and a note are what they say", () => {
  expect(asked({ verb: "title", id: "order", title: "order the new cabinets" }))
    .toEqual({ op: "title", id: "order", title: "order the new cabinets" })
  expect(asked({ verb: "desc", id: "order", desc: "oak" }))
    .toEqual({ op: "desc", id: "order", desc: "oak" })
  expect(asked({ verb: "desc", id: "order", desc: null }))
    .toEqual({ op: "desc", id: "order", desc: null })
})

// ── the condition a text edit may carry ────────────────────────────────

test("what a text edit expects to find travels WITH the request", () => {
  // And is not checked here, which is the point: the write gate re-plans a
  // request every time the store moves under it, so a condition tested at this
  // seam is a condition the retry does not test — an undo overwriting a
  // concurrent retitle (review, 2026-08-12). `@olai/ops`' planner owns it now,
  // and tests it on every attempt; this layer's job is to carry it.
  expect(
    asked({ verb: "title", id: "order", title: "put it back", was: "order the cabinets" }),
  ).toEqual({ op: "title", id: "order", title: "put it back", was: "order the cabinets" })
})

test("a note's condition travels too, `null` and all", () => {
  // `null` is a real expectation — "there was no note" — so it must reach the
  // planner as a value rather than collapsing into "not checking".
  expect(asked({ verb: "desc", id: "install", desc: "measure first", was: null }))
    .toEqual({ op: "desc", id: "install", desc: "measure first", was: null })
})

test("no condition is what a person typing sends, and it stays absent", () => {
  // Absent, not `undefined` in the payload: the ops layer reads presence, and
  // last-one-wins is what `set_title` has always meant. The draft's commit path
  // sends this and nothing else.
  expect(asked({ verb: "title", id: "order", title: "anything" }))
    .toEqual({ op: "title", id: "order", title: "anything" })
  expect("was" in asked({ verb: "title", id: "order", title: "anything" })).toBe(false)
})

// ── the mark, named outright — the menu's and an undo's ────────────────

test("a mark named outright is that mark's own op", () => {
  // The menu's half of the mark: it was chosen from a list drawn beside what
  // the node carries, so it says what it wants rather than asking to toggle.
  expect(asked({ verb: "mark", id: "install", mark: "todo" }))
    .toEqual({ op: "todo", id: "install" })
  expect(asked({ verb: "mark", id: "demo", mark: "doing" }))
    .toEqual({ op: "doing", id: "demo" })
})

test("clearing a mark is the STORED one's op, undone", () => {
  // Which mark to take off is a fact about the set, so it is read here rather
  // than sent: `Clear mark` is one entry whatever the row carries.
  expect(asked({ verb: "mark", id: "demo", mark: null }))
    .toEqual({ op: "done", id: "demo", undo: true })
  expect(asked({ verb: "mark", id: "order", mark: null }))
    .toEqual({ op: "doing", id: "order", undo: true })
})

test("clearing a mark from a node that carries none says so", () => {
  // Either caller can reach it and both mean the same thing: `Clear mark` is
  // drawn only on a marked row, and an undo only restores what it displaced —
  // so somebody else got there first. A person is owed the sentence rather
  // than a click that writes nothing.
  const failure = refused({ verb: "mark", id: "install", mark: null })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("carries no mark")
})

test("a mark on a mirror travels as the caller named it", () => {
  // The consistency rule again, from the menu's side: the client sends the id
  // of the node a row SHOWS, and an id that arrives here is not second-guessed
  // — `set_doing` on a placement is refused by the ops layer in its own words,
  // so this must be too.
  expect(asked({ verb: "mark", id: "echo", mark: "doing" }))
    .toEqual({ op: "doing", id: "echo" })
})

test("a mark on a node nothing declares is not found", () => {
  expect(refused({ verb: "mark", id: "ghost", mark: null })._tag).toBe("NotFoundFailure")
})

// ── the three the ••• menu speaks ──────────────────────────────────────
test("a date is the op's own field, clear and set alike", () => {
  // The menu sends only the first of these today — setting one is the `!`
  // picker's — and the verb spells both because the op does.
  expect(asked({ verb: "date", id: "order", date: null }))
    .toEqual({ op: "date", id: "order", date: null })
  expect(asked({ verb: "date", id: "order", date: "2026-09-01" }))
    .toEqual({ op: "date", id: "order", date: "2026-09-01" })
})

test("retiring a placement names the row's own record", () => {
  expect(asked({ verb: "unmirror", id: "echo" }))
    .toEqual({ op: "unmirror", id: "echo" })
})

test("retiring something that is not a placement is the OPS layer's to refuse", () => {
  // Not caught here, deliberately: `remove_mirror` on a node answers with a
  // paragraph explaining what a placement is and which op puts a node away,
  // and a shorter refusal invented here would be a worse answer to the same
  // mistake — told to a person and not to an agent.
  expect(asked({ verb: "unmirror", id: "kitchen" }))
    .toEqual({ op: "unmirror", id: "kitchen" })
})

test("archive is the op, subtree and all — the fence is the menu's question", () => {
  // `kitchen` has three children and a placement under it. Nothing here counts
  // them: the reader was asked, in the panel, before this was ever sent, and a
  // fence in this layer would be a rule `archive_node` does not have.
  expect(asked({ verb: "archive", id: "kitchen" }))
    .toEqual({ op: "archive", id: "kitchen" })
})

// ── the two an undo speaks ─────────────────────────────────────────────

test("putting a row back names the parent it was given and the sibling above", () => {
  expect(asked({ verb: "place", id: "handles", parent: "kitchen", after: "demo" }))
    .toEqual({ op: "move", id: "handles", parent: "kitchen", after: "demo" })
})

test("back to the FRONT of a branch is `before` whatever is first NOW", () => {
  // The one half of a placement that is resolved rather than recorded: "first
  // among its siblings" is a fact about the row as it stands, so an undo means
  // the front as it reads this instant — including whatever another writer put
  // there in the meantime.
  expect(asked({ verb: "place", id: "handles", parent: "kitchen", after: null }))
    .toEqual({ op: "move", id: "handles", parent: "kitchen", before: "demo" })
})

test("back into a branch that now holds nothing else drops the anchor", () => {
  expect(asked({ verb: "place", id: "handles", parent: "loose", after: null }))
    .toEqual({ op: "move", id: "handles", parent: "loose" })
})

test("back to the top level is `parent: null`, like an outdent", () => {
  expect(asked({ verb: "place", id: "handles", parent: null, after: "kitchen" }))
    .toEqual({ op: "move", id: "handles", parent: null, after: "kitchen" })
})

test("putting back a row nothing declares is not found", () => {
  expect(refused({ verb: "place", id: "ghost", parent: null, after: null })._tag)
    .toBe("NotFoundFailure")
})

test("a row taken back is archived, which is the only removal the set has", () => {
  expect(asked({ verb: "remove", id: "handles" }))
    .toEqual({ op: "archive", id: "handles" })
})

test("a row somebody has put work under is not an undo's to take back", () => {
  const failure = refused({ verb: "remove", id: "install" })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("under it now")
})

// ── what would take a write back ───────────────────────────────────────

/** The inverse of an edit over the house, with the id an `add` would have
 *  minted for the one case that needs one. */
const inverse = (
  edit: Edit,
  applied = "minted",
  at: Reading = reading(),
): ReadonlyArray<Edit> => inverseOf(at, edit, applied)

test("a move records where the row SAT — its parent, and the row above it", () => {
  // `install` is third among the kitchen's children, so the place it leaves is
  // "under kitchen, after order" whichever of the four moves took it away.
  const back: ReadonlyArray<Edit> = [
    { verb: "place", id: "install", parent: "kitchen", after: "order" },
  ]
  expect(inverse({ verb: "move", id: "install", how: "in" })).toEqual(back)
  expect(inverse({ verb: "move", id: "install", how: "out" })).toEqual(back)
  expect(inverse({ verb: "move", id: "install", how: "up" })).toEqual(back)
})

test("the FIRST of its siblings records `after: null` — a place with no neighbour", () => {
  expect(inverse({ verb: "move", id: "demo", how: "down" }))
    .toEqual([{ verb: "place", id: "demo", parent: "kitchen", after: null }])
})

test("a top-level row records `parent: null` and the row above it in the file", () => {
  expect(inverse({ verb: "move", id: "loose", how: "in" }))
    .toEqual([{ verb: "place", id: "loose", parent: null, after: "kitchen" }])
})

test("an undo is itself undoable: a place records the place it leaves", () => {
  // What makes redo the same machinery as undo rather than a second stack with
  // rules of its own — every replay answers with what would replay IT.
  expect(inverse({ verb: "place", id: "handles", parent: "kitchen", after: null }))
    .toEqual([{ verb: "place", id: "handles", parent: "install", after: null }])
})

test("a toggle records the mark it replaced, and `null` for none", () => {
  expect(inverse({ verb: "toggle", id: "install", mark: "done" }))
    .toEqual([{ verb: "mark", id: "install", mark: null }])
  expect(inverse({ verb: "toggle", id: "demo", mark: "done" }))
    .toEqual([{ verb: "mark", id: "demo", mark: "done" }])
})

test("putting a mark back over a `done` node is TWO ops, as it is for an agent", () => {
  // `order` is `doing`, so ticking it off replaces that mark. The ops layer
  // refuses any other mark over a node that is done ("undo that first"), so
  // the way back is the way an agent would take it: take the done off, put the
  // old mark on. One op here would be the web doing what MCP cannot.
  expect(inverse({ verb: "toggle", id: "order", mark: "done" }))
    .toEqual([
      { verb: "mark", id: "order", mark: null },
      { verb: "mark", id: "order", mark: "doing" },
    ])
})

test("a new row is taken back by the id the write minted, not one read before it", () => {
  expect(inverse({ verb: "add", at: { kind: "after", id: "order" }, title: "measure" }, "n7"))
    .toEqual([{ verb: "remove", id: "n7" }])
})

test("a title records the title it replaced, and what it is replacing it with", () => {
  // The human drove this and found it missing (2026-08-12): a committed title
  // is an op like any other and has a perfect inverse. `was` is the second
  // half — the undo may only overwrite what this write wrote.
  expect(inverse({ verb: "title", id: "order", title: "order the walnut ones" }))
    .toEqual([{
      verb: "title",
      id: "order",
      title: "order the cabinets",
      was: "order the walnut ones",
    }])
})

test("a note records the note it replaced, and `null` for a row that had none", () => {
  expect(inverse({ verb: "desc", id: "install", desc: "measure first" }))
    .toEqual([{ verb: "desc", id: "install", desc: null, was: "measure first" }])
  // And emptying one records putting it back.
  expect(inverse({ verb: "desc", id: "order", desc: null }))
    .toEqual([{ verb: "desc", id: "order", desc: "oak, or birch", was: null }])
})

test("undoing a text edit is undoable in its turn — the pair, the other way round", () => {
  // What makes ⌘⇧Z the same machinery for text as for everything else. The
  // undo's own inverse is derived where every inverse is: from the reading its
  // write is judged against, which by then says what the first write wrote.
  const landed = reading(
    setOf({
      "house.jsonl": HOUSE.replace(
        `"title":"order the cabinets"`,
        `"title":"order the walnut ones"`,
      ),
    }),
  )
  const undoing: Edit = {
    verb: "title",
    id: "order",
    title: "order the cabinets",
    was: "order the walnut ones",
  }
  expect(inverse(undoing, "minted", landed)).toEqual([{
    verb: "title",
    id: "order",
    title: "order the walnut ones",
    was: "order the cabinets",
  }])
})

test("a MIRROR has no text of its own, so there is nothing to take back", () => {
  // The ops layer refuses the write in its own words; this just has nothing to
  // record about it.
  expect(inverse({ verb: "title", id: "echo", title: "x" })).toEqual([])
})

test("a cleared date is put back as the date it cleared", () => {
  // The `•••` menu's one undoable write, and the reason its wire field is the
  // op's full `string | null` rather than the `null` the menu is the only
  // sender of: a clear-only verb could not spell its own inverse.
  expect(inverse({ verb: "date", id: "order", date: null }))
    .toEqual([{ verb: "date", id: "order", date: "2026-08-10" }])
})

test("a date set over nothing is put back as nothing", () => {
  expect(inverse({ verb: "date", id: "install", date: "2026-09-01" }))
    .toEqual([{ verb: "date", id: "install", date: null }])
})

test("a MIRROR has no date of its own either", () => {
  expect(inverse({ verb: "date", id: "echo", date: null })).toEqual([])
})

test("what nothing would take back says so with an empty list", () => {
  // THREE writes answer that way, and they mean three different things. A
  // `remove` and an `archive` have put records in `Archive.jsonl`, which no
  // move brings back out (a parent is same-file by the format, and the archive
  // is another file) and which no face can unarchive yet. An `unmirror` could
  // be undone in principle — put the placement back — and this surface has no
  // verb that creates one, so inventing a browser-only mirror-create to serve
  // an undo would be the deviation the menu's verbs exist to close.
  expect(inverse({ verb: "remove", id: "handles" })).toEqual([])
  expect(inverse({ verb: "archive", id: "install" })).toEqual([])
  expect(inverse({ verb: "unmirror", id: "echo" })).toEqual([])
})
