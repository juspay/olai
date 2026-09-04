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

import {
  INBOX,
  mintedInto,
  type OpFailure,
  type OutlineSet,
  PINS,
  type Reading,
} from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { Request } from "@olai/ops"
import type { Edit } from "@olai/surface"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { inverseOf, requestFor } from "./edit.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-10","desc":"oak, or birch","custom":{"pr":"https://x/1","tags":["a","b"]}}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"pick the handles"}`,
  `{"id":"loose","ord":"a1","title":"a node with no children"}`,
  `{"id":"echo","ord":"a2","mirror":"order"}`,
].join("\n")

const reading = (set: OutlineSet = setOf({ "house.olai": HOUSE })): Reading =>
  readingOf(set)

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
    .toEqual({ op: "add", file: "house.olai", after: "kitchen", title: "garage" })
})

test("Enter at column 0 names before the row, same parent as after would", () => {
  expect(asked({ verb: "add", at: { kind: "before", id: "order" }, title: "measure" }))
    .toEqual({ op: "add", parent: "kitchen", before: "order", title: "measure" })
  expect(asked({ verb: "add", at: { kind: "before", id: "kitchen" }, title: "garage" }))
    .toEqual({ op: "add", file: "house.olai", before: "kitchen", title: "garage" })
})

test("the first child of a branch goes under it, last among nothing", () => {
  expect(asked({ verb: "add", at: { kind: "under", id: "loose" }, title: "a first" }))
    .toEqual({ op: "add", parent: "loose", title: "a first" })
})

test("the first row of an empty outline is the one place a file is named", () => {
  expect(asked({ verb: "add", at: { kind: "first", file: "new.olai" }, title: "one" }))
    .toEqual({ op: "add", file: "new.olai", title: "one" })
})

test("a new row after a MIRROR is a sibling of the mirror", () => {
  // Where the reader is looking, rather than beside the node the placement
  // stands for — which is somewhere else, in another parent, possibly in
  // another file. A mirror carries a parent and an `ord` like any record, so
  // there is nothing to resolve through.
  expect(asked({ verb: "add", at: { kind: "after", id: "echo" }, title: "x" }))
    .toEqual({ op: "add", file: "house.olai", after: "echo", title: "x" })
})

test("a new row after a node nothing declares is not found", () => {
  expect(refused({ verb: "add", at: { kind: "after", id: "ghost" }, title: "x" })._tag)
    .toBe("NotFoundFailure")
})

// ── the palette's capture ──────────────────────────────────────────────

test("a capture into a directory with an inbox is an `add` into that file", () => {
  const set = setOf({ "house.olai": HOUSE, [INBOX]: "" })
  expect(asked({ verb: "capture", title: "buy milk" }, reading(set)))
    .toEqual({ op: "add", file: INBOX, title: "buy milk", mark: "todo" })
})

test("a capture into a directory with NO inbox mints one under `_olai/`", () => {
  // ONE op, so a refused seed leaves no file behind — an `add` that followed a
  // `create` could land the file and then refuse the line.
  //
  // WHERE it is minted REVERSES the 2026-08-19 ruling that kept the inbox at
  // the root (human, 2026-08-20): a file olai made because somebody pressed
  // something goes where those go, beside the shelf and the trash. What is
  // untouched is the READING — the three tests below are the same three.
  expect(asked({ verb: "capture", title: "buy milk" }))
    .toEqual({
      op: "create",
      file: mintedInto(INBOX),
      seed: { title: "buy milk", mark: "todo" },
    })
  expect(mintedInto(INBOX)).toBe("_olai/Inbox.olai")
})

// …born `todo` under the one law the badge reads (the rows marked `todo` or
// `doing` are what awaits you): every arm above ends in `mark: "todo"`, so a
// capture is visible to the count from the moment it lands. Minted by
// `captureInto`, so the `capture` tool mints it the same way.

test("an inbox the directory already keeps somewhere else is the one used", () => {
  // The convention is the NAME, not the place: a directory that files its
  // inbox under `notes/` captures into the file it has rather than growing a
  // second one at the root.
  const set = setOf({ "house.olai": HOUSE, "notes/inbox.olai": "" })
  expect(asked({ verb: "capture", title: "buy milk" }, reading(set)))
    .toEqual({ op: "add", file: "notes/inbox.olai", title: "buy milk", mark: "todo" })
})

test("with two inboxes the shallower one wins, so the answer is stable", () => {
  const set = setOf({
    "deep/down/Inbox.olai": "",
    [INBOX]: "",
    "house.olai": HOUSE,
  })
  expect(asked({ verb: "capture", title: "buy milk" }, reading(set)))
    .toEqual({ op: "add", file: INBOX, title: "buy milk", mark: "todo" })
})

test("a file merely ENDING in the name is not an inbox", () => {
  const set = setOf({ "house.olai": HOUSE, "not-an-Inbox.olai": "" })
  expect(asked({ verb: "capture", title: "buy milk" }, reading(set)))
    .toEqual({
      op: "create",
      file: mintedInto(INBOX),
      seed: { title: "buy milk", mark: "todo" },
    })
})

test("a blank capture is left to the ops layer, which has the words for it", () => {
  // No second rule here: `add_node` refuses an empty title in the sentence an
  // agent gets, and a fence in this resolver would be a fence one face has.
  expect(asked({ verb: "capture", title: "   " }))
    .toEqual({
      op: "create",
      file: mintedInto(INBOX),
      seed: { title: "   ", mark: "todo" },
    })
})

// ── the shelf's pin ────────────────────────────────────────────────────

test("a pin into a directory with a shelf is an `add` into that file", () => {
  const set = setOf({ "house.olai": HOUSE, [PINS]: "" })
  expect(asked({ verb: "pin", at: "/#order" }, reading(set)))
    .toEqual({ op: "add", file: PINS, title: "/#order" })
})

test("a pin into a directory with NO shelf mints one under `_olai/`", () => {
  // The capture's argument one convention over: ONE op, so a refused pin
  // leaves no empty shelf behind. WHERE it is minted is the human's ruling of
  // 2026-08-19 — a file olai made because somebody pressed something is not one
  // of the reader's own, and the top level of a served directory is theirs.
  expect(asked({ verb: "pin", at: "/agenda?q=is%3Atodo" }))
    .toEqual({
      op: "create",
      file: mintedInto(PINS),
      seed: { title: "/agenda?q=is%3Atodo" },
    })
  expect(mintedInto(PINS)).toBe("_olai/Pins.olai")
})

test("…and a shelf the directory already has is found wherever it sits", () => {
  // The MINT moved and the READING did not, which is what keeps every existing
  // vault pinning into the file it already has — at the root, or anywhere else.
  for (const held of [PINS, "notes/pins.olai", "_olai/Pins.olai"]) {
    const set = setOf({ "house.olai": HOUSE, [held]: "" })
    expect(asked({ verb: "pin", at: "/today" }, reading(set)))
      .toEqual({ op: "add", file: held, title: "/today" })
  }
})

test("a shelf the directory already keeps somewhere else is the one used", () => {
  const set = setOf({ "house.olai": HOUSE, "notes/pins.olai": "" })
  expect(asked({ verb: "pin", at: "/today" }, reading(set)))
    .toEqual({ op: "add", file: "notes/pins.olai", title: "/today" })
})

test("a pin names NO anchor, so it lands last on the shelf", () => {
  // Where a new bookmark goes, and the ops layer's own default for an `add`
  // that names no sibling. Where it goes afterwards is a drag's `place`.
  const set = setOf({ "house.olai": HOUSE, [PINS]: `{"id":"p","ord":"a0","title":"/today"}` })
  expect(asked({ verb: "pin", at: "/agenda" }, reading(set)))
    .toEqual({ op: "add", file: PINS, title: "/agenda" })
})

test("the address is carried VERBATIM — nothing on the way parses one", () => {
  // A date crosses as the ten characters that were picked; an address crosses
  // as the characters this app minted. What reads it back is the browser, at
  // view time, through the same bijection that wrote it.
  expect(asked({ verb: "pin", at: "/a b.olai" }))
    .toEqual({ op: "create", file: mintedInto(PINS), seed: { title: "/a b.olai" } })
})

test("a pin that carried a NAME lands as the link `Pins.olai` spells one with", () => {
  // The row is still one ordinary node whose title is an address — inside a
  // markdown link, which is the spelling an agent writes by hand and the one
  // the shelf and the file's own page both draw (docs/format.md's Pins). No
  // second write, so ⌘Z takes the whole intention back.
  const set = setOf({ "house.olai": HOUSE, [PINS]: "" })
  expect(asked({ verb: "pin", at: "/agenda?q=is%3Atodo", name: "What is late" }, reading(set)))
    .toEqual({ op: "add", file: PINS, title: "[What is late](/agenda?q=is%3Atodo)" })
  // …and into a directory with no shelf, the same title is the seed.
  expect(asked({ verb: "pin", at: "/agenda?q=is%3Atodo", name: "What is late" }))
    .toEqual({
      op: "create",
      file: mintedInto(PINS),
      seed: { title: "[What is late](/agenda?q=is%3Atodo)" },
    })
})

test("a BLANK name is the bare pin — naming nothing is what it always was", () => {
  // The box a reader pressed Enter in with nothing typed sends the words it
  // holds, and "no name" is not a second gesture.
  const set = setOf({ "house.olai": HOUSE, [PINS]: "" })
  for (const name of ["", "   "]) {
    expect(asked({ verb: "pin", at: "/#order", name }, reading(set)))
      .toEqual({ op: "add", file: PINS, title: "/#order" })
  }
})

test("a name the link's grammar cannot hold is REFUSED, and nothing is written", () => {
  // A `]` closes the label early, so the title written past it is no longer an
  // address — the row would sit in the file and never appear on the shelf,
  // which is the silent failure this refusal exists to prevent.
  const failure = refused({ verb: "pin", at: "/#order", name: "late] things" })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("]")
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

test("the picker's move names the parent it was given, and nothing else", () => {
  // The FIFTH move, and the one that resolves nothing: where among that
  // parent's children is the ops layer's own default — last — which is the same
  // request `Tab` above ends at. Anything more here would be this resolver
  // computing a placement the picker never asked for.
  expect(asked({ verb: "under", id: "handles", parent: "order" }))
    .toEqual({ op: "move", id: "handles", parent: "order" })
})

test("a destination this resolver cannot judge is passed through to the PLANNER", () => {
  // Whether that parent is reachable — same file, no loop, a node rather than a
  // placement — is `planMove`'s to answer, in the words an agent gets, and this
  // arm invents none of it. `echo` is a mirror, which the ops layer refuses as
  // a parent naming the node to go to instead.
  expect(asked({ verb: "under", id: "handles", parent: "echo" }))
    .toEqual({ op: "move", id: "handles", parent: "echo" })
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
    "house.olai": `${HOUSE}\n{"id":"later","ord":"a3","title":"and one after it"}`,
  })
  expect(asked({ verb: "move", id: "later", how: "in" }, reading(set)))
    .toEqual({ op: "move", id: "later", parent: "order" })
})

test("indenting under a mirror of nothing is refused rather than doomed", () => {
  const set = setOf({
    "a.olai": [
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

// ── the mark walk ──────────────────────────────────────────────────────

/** The same house with one node carrying a mark — the middle of the ring,
 *  which the fixture has no node sitting at. A `replace` over the line rather
 *  than a second fixture: what these tests are about is the ONE field, and a
 *  parallel corpus would be seven lines of agreement to keep. */
const marked = (id: string, mark: string): Reading => {
  const line = HOUSE.split("\n").find((one) => one.includes(`"id":"${id}"`))
  if (line === undefined) throw new Error(`no \`${id}\` in the fixture`)
  return reading(setOf({
    "house.olai": HOUSE.replace(line, `${line.slice(0, -1)},"${mark}":true}`),
  }))
}

test("the walk goes bullet → todo → doing → bullet, one op a step", () => {
  // The whole ring, and the last step is the one that makes an unmarked node
  // an ANSWER rather than a gap: `doing` walks to no mark at all, which is the
  // stored mark's own op undone — the same request `Clear mark` builds.
  expect(asked({ verb: "walk", id: "install" })).toEqual({ op: "todo", id: "install" })
  expect(asked({ verb: "walk", id: "install" }, marked("install", "todo")))
    .toEqual({ op: "doing", id: "install" })
  expect(asked({ verb: "walk", id: "order" }))
    .toEqual({ op: "doing", id: "order", undo: true })
})

test("the walk asks a done node for `todo`, and the ops layer is what says no", () => {
  // `done` is not a stop on the ring — nothing should finish work on the way
  // past — so a walk from it asks for the ring's first answer OUTRIGHT, which
  // is the request `set_todo` makes and the one the ops layer refuses in its
  // own words ("undo that first"). Fencing it here would hide the refusal a
  // person needs to meet, and teach a rule this layer does not own.
  expect(asked({ verb: "walk", id: "demo" })).toEqual({ op: "todo", id: "demo" })
})

test("a walk on a mirror steps from the mark that row DRAWS, and keeps its id", () => {
  // `echo` shows `order`, which is `doing` — and a mirror's status IS its
  // target's, so the step is the one the reader can see. The id is not
  // second-guessed with it: a mark on a placement is refused by the ops layer
  // naming the node to use instead, exactly as it refuses the same tool call
  // from an agent. The client sends the id of the node a row SHOWS.
  expect(asked({ verb: "walk", id: "echo" }))
    .toEqual({ op: "doing", id: "echo", undo: true })
})

test("a walk on a node nothing declares is not found", () => {
  expect(refused({ verb: "walk", id: "ghost" })._tag).toBe("NotFoundFailure")
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

test("a property's condition travels too — `null` expecting the key GONE", () => {
  // The chip's commit ALWAYS sends one: the value the editor opened on, and
  // `null` for a key the run did not have — the add editor's snapshot is the
  // absence. The wire spells all three states for the note's reason: not
  // checking, checking for nothing, checking for this text.
  expect(asked({ verb: "prop", id: "order", key: "pr", value: "https://x/2", was: "https://x/1" }))
    .toEqual({ op: "prop", id: "order", key: "pr", value: "https://x/2", was: "https://x/1" })
  expect(asked({ verb: "prop", id: "order", key: "stage", value: "review", was: null }))
    .toEqual({ op: "prop", id: "order", key: "stage", value: "review", was: null })
  // ...and the one shape a caller may still spell without it, absent whole.
  expect(asked({ verb: "prop", id: "order", key: "pr", value: "anything" }))
    .toEqual({ op: "prop", id: "order", key: "pr", value: "anything" })
  expect("was" in asked({ verb: "prop", id: "order", key: "pr", value: "anything" })).toBe(false)
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

// The REPEAT RULE, the same shape one field along — and the same two doors: the
// picker sends the rule, the menu's `Stop repeating` sends the `null`.
test("a repeat rule is the op's own field, set and stopped alike", () => {
  expect(asked({ verb: "repeat", id: "order", repeat: "every week on monday" }))
    .toEqual({ op: "repeat", id: "order", repeat: "every week on monday" })
  expect(asked({ verb: "repeat", id: "order", repeat: null }))
    .toEqual({ op: "repeat", id: "order", repeat: null })
})

// The whole point of the spawn living in the PLANNER: `Complete` on a row is
// `toggle`, which resolves to the same `done` request `set_done` sends — so
// there is no web-side rule to keep in step with the agent's, and this test is
// about the ABSENCE of one. The occurrence itself is the ops suite's.
test("completing a repeating row asks for exactly what `set_done` asks for", () => {
  const at = reading(setOf({
    "chores.olai": `{"id":"bins","ord":"a0","title":"put the bins out",` +
      `"todo":true,"date":"2026-08-17","repeat":"every week on monday"}`,
  }))
  expect(asked({ verb: "toggle", id: "bins", mark: "done" }, at))
    .toEqual({ op: "done", id: "bins" })
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

test("unarchive passes through, destination and all — the chain is the op's to follow", () => {
  // `Put back` sends the id alone and the ops layer follows the recorded
  // chain; an undo sends the place it read off this seam. Neither is resolved
  // here — there is nothing about siblings or marks to read — so both travel
  // as they are, and every refusal met is the planner's own.
  expect(asked({ verb: "untrash", id: "handles" }))
    .toEqual({ op: "untrash", id: "handles" })
  expect(asked({ verb: "untrash", id: "handles", parent: "install" }))
    .toEqual({ op: "untrash", id: "handles", parent: "install" })
  expect(asked({ verb: "untrash", id: "loose", file: "house.olai" }))
    .toEqual({ op: "untrash", id: "loose", file: "house.olai" })
})

test("the inverse of a put-back is the archive that made the row a trash row", () => {
  expect(inverse({ verb: "untrash", id: "handles" }))
    .toEqual([{ verb: "trash", id: "handles" }])
})

test("archive is the op, subtree and all — the fence is the menu's question", () => {
  // `kitchen` has three children and a placement under it. Nothing here counts
  // them: the reader was asked, in the panel, before this was ever sent, and a
  // fence in this layer would be a rule `trash_node` does not have.
  expect(asked({ verb: "trash", id: "kitchen" }))
    .toEqual({ op: "trash", id: "kitchen" })
})

test("duplicate is the op and nothing else — the copy is the op's to build", () => {
  // Nothing is resolved behind it: what the copy says is on disk, and the
  // subtree is read where the write is judged rather than assembled here out
  // of an `add` per node.
  expect(asked({ verb: "duplicate", id: "install" }))
    .toEqual({ op: "duplicate", id: "install" })
})

test("a duplicate through a placement is refused where every other op refuses one", () => {
  // `echo` is a mirror of `order`. The id travels as the caller named it, so
  // the refusal is `duplicate_node`'s own — a placement is not a node — rather
  // than this file quietly copying the target's subtree into a file the reader
  // is not looking at.
  expect(asked({ verb: "duplicate", id: "echo" }))
    .toEqual({ op: "duplicate", id: "echo" })
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
  // No `file` on the edit, which is a placement recorded before a row could
  // leave its outline: "the top level" means the one it is in, exactly as it
  // always did.
  expect(asked({ verb: "place", id: "handles", parent: null, after: "kitchen" }))
    .toEqual({ op: "move", id: "handles", parent: null, after: "kitchen" })
})

test("back to the top level of ANOTHER outline names that outline", () => {
  // What the `file` on a place is for. `move_node` carries a row between
  // outlines now, so an undo of a top-level row's crossing has to say which
  // top level — `parent: null` alone would put it back at the top of wherever
  // it had got to. The neighbour is still resolved against the set as it
  // stands, in the outline it is going back to rather than the one it is in.
  const set = setOf({
    "house.olai": HOUSE,
    "garden.olai": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  })
  expect(
    asked({ verb: "place", id: "herbs", parent: null, file: "house.olai", after: null }, reading(set)),
  ).toEqual({ op: "move", id: "herbs", parent: null, file: "house.olai", before: "kitchen" })
})

test("...and with a parent the file decides nothing, so it does not travel", () => {
  // The ops layer's own rule about the pair, kept rather than re-argued: a
  // parent is in its own file, and a second answer beside it could only
  // disagree.
  expect(asked({ verb: "place", id: "handles", parent: "kitchen", file: "house.olai", after: "demo" }))
    .toEqual({ op: "move", id: "handles", parent: "kitchen", after: "demo" })
})

test("putting back a row nothing declares is not found", () => {
  expect(refused({ verb: "place", id: "ghost", parent: null, after: null })._tag)
    .toBe("NotFoundFailure")
})

test("a row taken back is archived, which is the only removal the set has", () => {
  expect(asked({ verb: "remove", id: "handles" }))
    .toEqual({ op: "trash", id: "handles" })
})

test("a row somebody has put work under is not an undo's to take back", () => {
  const failure = refused({ verb: "remove", id: "install" })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("under it now")
})

// ── the two compound keys ──────────────────────────────────────────────

test("a split carries the two texts and resolves nothing else", () => {
  // Both halves are the DRAFT's, and where the tail lands is the ops layer's —
  // so this seam has no arithmetic of its own to get wrong.
  expect(asked({ verb: "split", id: "order", title: "order ", rest: "the cabinets" }))
    .toEqual({ op: "split", id: "order", title: "order ", rest: "the cabinets" })
})

test("a merge names the row and nothing else — the sibling above is the set's", () => {
  expect(asked({ verb: "merge", id: "install" })).toEqual({ op: "merge", id: "install" })
})

// ── the trash, emptied ─────────────────────────────────────────────────

/** A house with the one trash, filled. */
const ARCHIVED = [
  `{"id":"sc1","ord":"a0","title":"house.olai"}`,
  `{"id":"sc2","parent":"sc1","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"knobs","parent":"sc2","ord":"a0","title":"pick the knobs"}`,
].join("\n")

test("emptying resolves to one `empty`, naming the one trash", () => {
  const at = reading(setOf({ "house.olai": HOUSE, "_olai/Trash.olai": ARCHIVED }))
  expect(asked({ verb: "emptyTrash" }, at))
    .toEqual({ op: "empty", file: "_olai/Trash.olai" })
})

test("a leftover Archive.olai is not emptied — it is not the trash", () => {
  const at = reading(setOf({
    "house.olai": HOUSE,
    "_olai/Trash.olai": ARCHIVED,
    "Archive.olai": `{"id":"old","ord":"a0","title":"something left behind"}`,
    "garden/Archive.olai": `{"id":"older","ord":"a0","title":"another leftover"}`,
  }))
  expect(asked({ verb: "emptyTrash" }, at))
    .toEqual({ op: "empty", file: "_olai/Trash.olai" })
})

test("an empty trash file is not in the list at all", () => {
  // An emptied trash is a file the directory still serves — `untrash`
  // tidies its scaffold away and leaves it standing — so the resolution has to
  // skip it rather than send a path the planner is about to refuse.
  const at = reading(setOf({
    "house.olai": HOUSE,
    "_olai/Trash.olai": "",
  }))
  const failure = refused({ verb: "emptyTrash" }, at)
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toBe("the Trash is empty, so there is nothing to delete")
})

test("the count the confirm showed travels, and is never re-derived here", () => {
  // Re-deriving it would be the second reading this whole file exists to
  // avoid — and a useless guard besides, since a count taken from THIS reading
  // would always agree with itself. What it guards is the retry, which the
  // planner checks on every attempt.
  const at = reading(setOf({ "house.olai": HOUSE, "_olai/Trash.olai": ARCHIVED }))
  expect(asked({ verb: "emptyTrash", was: 9 }, at))
    .toEqual({ op: "empty", file: "_olai/Trash.olai", was: 9 })
})

test("an empty trash is refused HERE, in terms of the trash", () => {
  // The button is not drawn over an empty trash, so what reaches this is a
  // stale tab — and a stale tab deserves the true sentence rather than
  // the planner's already-empty refusal, which names the file rather than
  // the stale tab.
  const failure = refused({ verb: "emptyTrash" }, reading())
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toBe("the Trash is empty, so there is nothing to delete")
})

// ── what would take a write back ───────────────────────────────────────

/** The inverse of an edit over the house, with the id an `add` would have
 *  minted for the one case that needs one. */
/** The inverse, over the same reading — and paired with the request the edit
 *  RESOLVES to, exactly as the one real caller pairs them (`./runtime.ts`).
 *  Resolved here rather than handed in, so a test cannot accidentally ask what
 *  would take back a write that was never going to happen. */
const inverse = (
  edit: Edit,
  applied = "minted",
  at: Reading = reading(),
): ReadonlyArray<Edit> => inverseOf(at, edit, asked(edit, at), applied)

test("a move records where the row SAT — its parent, and the row above it", () => {
  // `install` is third among the kitchen's children, so the place it leaves is
  // "under kitchen, after order" whichever of the four moves took it away.
  const back: ReadonlyArray<Edit> = [
    { verb: "place", id: "install", parent: "kitchen", file: "house.olai", after: "order" },
  ]
  expect(inverse({ verb: "move", id: "install", how: "in" })).toEqual(back)
  expect(inverse({ verb: "move", id: "install", how: "out" })).toEqual(back)
  expect(inverse({ verb: "move", id: "install", how: "up" })).toEqual(back)
})

test("the FIRST of its siblings records `after: null` — a place with no neighbour", () => {
  expect(inverse({ verb: "move", id: "demo", how: "down" }))
    .toEqual([{ verb: "place", id: "demo", parent: "kitchen", file: "house.olai", after: null }])
})

test("a top-level row records `parent: null`, the OUTLINE, and the row above it", () => {
  // The file is the half that only matters here, and it is why a place carries
  // one at all: with a parent, the parent's own file is the answer — with none,
  // "the top level" is the top level of a named outline, and `move_node` can
  // carry a row out of it into another.
  expect(inverse({ verb: "move", id: "loose", how: "in" }))
    .toEqual([{ verb: "place", id: "loose", parent: null, file: "house.olai", after: "kitchen" }])
})

test("the picker's move records the place it leaves, like every other one", () => {
  // Same question as the four above, asked before a write that carries the row
  // to a named parent instead of one step from where it was — so ⌘Z is a
  // `place` back, with the neighbour, and not "under my old parent" (which
  // would put a row that was third among its siblings at the end of them).
  expect(inverse({ verb: "under", id: "install", parent: "loose" }))
    .toEqual([{ verb: "place", id: "install", parent: "kitchen", file: "house.olai", after: "order" }])
})

test("an undo is itself undoable: a place records the place it leaves", () => {
  // What makes redo the same machinery as undo rather than a second stack with
  // rules of its own — every replay answers with what would replay IT.
  expect(inverse({ verb: "place", id: "handles", parent: "kitchen", after: null }))
    .toEqual([{ verb: "place", id: "handles", parent: "install", file: "house.olai", after: null }])
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

test("a walk is taken back by the mark it stepped off, in ONE call", () => {
  // The walk asks the same question every other mark write asks — what does
  // this node carry — so it needs no inverse of its own. What it never needs is
  // the two-call form: `done` is not a stop on the ring, so no step of it
  // leaves finished work behind to be undone first.
  // Every stop of the ring, so the inverse is covered as completely as the
  // request is (review, 2026-08-12): out of a bullet, out of `todo`, and off
  // the last stop back onto the mark it stepped off.
  expect(inverse({ verb: "walk", id: "install" }))
    .toEqual([{ verb: "mark", id: "install", mark: null }])
  expect(inverse({ verb: "walk", id: "install" }, "minted", marked("install", "todo")))
    .toEqual([{ verb: "mark", id: "install", mark: "todo" }])
  expect(inverse({ verb: "walk", id: "order" }))
    .toEqual([{ verb: "mark", id: "order", mark: "doing" }])
})

test("taking a mark OFF is put back by putting it on, and nothing else", () => {
  // The pair this used to answer with was refused on replay: its first half
  // took a mark off a row that no longer had one ("carries no mark"), and the
  // undo was dropped with a reason nobody could act on. Two calls are for the
  // write that leaves a node DONE, and taking a mark off leaves it a bullet.
  expect(inverse({ verb: "mark", id: "order", mark: null }))
    .toEqual([{ verb: "mark", id: "order", mark: "doing" }])
})

test("a mark chosen outright says for itself whether the way back is two", () => {
  // `Complete` over a `doing` row is the shape that needs both calls; `Mark
  // doing` over the same row is one, because what it leaves is not done.
  expect(inverse({ verb: "mark", id: "order", mark: "done" }))
    .toEqual([
      { verb: "mark", id: "order", mark: null },
      { verb: "mark", id: "order", mark: "doing" },
    ])
  expect(inverse({ verb: "mark", id: "order", mark: "todo" }))
    .toEqual([{ verb: "mark", id: "order", mark: "doing" }])
})

test("a new row is taken back by the id the write minted, not one read before it", () => {
  expect(inverse({ verb: "add", at: { kind: "after", id: "order" }, title: "measure" }, "n7"))
    .toEqual([{ verb: "remove", id: "n7" }])
})

test("a capture is taken back the same way a new row is", () => {
  // Both cases: the row goes whether the write landed in an inbox that existed
  // or in one it minted. What ⌘Z does NOT do is unmint the file — no face
  // removes one.
  expect(inverse({ verb: "capture", title: "buy milk" }, "n7"))
    .toEqual([{ verb: "remove", id: "n7" }])
  expect(
    inverse(
      { verb: "capture", title: "buy milk" },
      "n7",
      reading(setOf({ "house.olai": HOUSE, [INBOX]: "" })),
    ),
  ).toEqual([{ verb: "remove", id: "n7" }])
})

test("a pin is taken back the same way a capture is", () => {
  // Both are an `add` a person did not choose the place for, so both go by the
  // same narrowed un-create — and a shelf this pin MINTED is left standing,
  // for the reason a minted inbox is.
  expect(inverse({ verb: "pin", at: "/#order" }, "n7"))
    .toEqual([{ verb: "remove", id: "n7" }])
  expect(
    inverse(
      { verb: "pin", at: "/#order" },
      "n7",
      reading(setOf({ "house.olai": HOUSE, [PINS]: "" })),
    ),
  ).toEqual([{ verb: "remove", id: "n7" }])
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
      "house.olai": HOUSE.replace(
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

test("a stopped recurrence is put back as the rule it stopped", () => {
  const at = reading(setOf({
    "chores.olai": `{"id":"bins","ord":"a0","title":"put the bins out",` +
      `"todo":true,"date":"2026-08-17","repeat":"every week on monday"}`,
  }))
  expect(inverse({ verb: "repeat", id: "bins", repeat: null }, "minted", at))
    .toEqual([{ verb: "repeat", id: "bins", repeat: "every week on monday" }])
  // …and a rule set over nothing is put back as nothing, which is the same arm.
  expect(inverse({ verb: "repeat", id: "install", repeat: "every day" }))
    .toEqual([{ verb: "repeat", id: "install", repeat: null }])
  // A placement carries no rule of its own, exactly as it carries no date.
  expect(inverse({ verb: "repeat", id: "echo", repeat: null })).toEqual([])
})

test("a property is put back as the value it held, conditional on the write's own shape", () => {
  // The wire half of the same guarantee `textOf` makes: the undo may only
  // overwrite what THIS write wrote, so `was` is the write's own value —
  // `null` when the write REMOVED the key, which is the one way "its
  // afterwards" has no text at all.
  expect(inverse({ verb: "prop", id: "order", key: "pr", value: null }))
    .toEqual([{ verb: "prop", id: "order", key: "pr", value: "https://x/1", was: null }])
  expect(inverse({ verb: "prop", id: "install", key: "stage", value: "review" }))
    .toEqual([{ verb: "prop", id: "install", key: "stage", value: null, was: "review" }])
  // `""` is the removal's own spelling — an emptied value box sends it — so
  // its afterwards is an absent key, which `null` expects.
  expect(inverse({ verb: "prop", id: "order", key: "pr", value: "" }))
    .toEqual([{ verb: "prop", id: "order", key: "pr", value: "https://x/1", was: null }])
})

/**
 * A key holding a LIST has NO inverse, and nothing is the honest answer.
 *
 * The menu offers `Remove tags` on such a key (`set_prop` writes text, so it
 * cannot offer to edit one), and the arm that used to be here read the value
 * as text — `undefined` for a list — and then spelled `?? null`. So the undo of
 * a removal was a SECOND removal: ⌘Z looked like it worked and the list was
 * gone with nothing to say so (Grok, review of #179). An undo with no inverse
 * is not recorded at all, which is what a person can act on.
 */
test("a property holding a LIST has no inverse, rather than a wrong one", () => {
  expect(inverse({ verb: "prop", id: "order", key: "tags", value: null })).toEqual([])
})

test("a duplicate is taken back by putting the COPY away, never the original", () => {
  // `applied` is the copy's root — the one id in an inverse that did not exist
  // when the reading was taken — and the original is untouched by both the
  // write and its undo. ⌘⇧Z is the `unarchive` that answers the archive.
  expect(inverse({ verb: "duplicate", id: "install" }, "copy"))
    .toEqual([{ verb: "trash", id: "copy" }])
})

test("an archive records the place the row is about to stop having", () => {
  // The parent as this reading holds it — an id an agent would have named,
  // not the title chain the archive is about to write in its place. An undo
  // that leaned on the chain would be a title match where the server had the
  // fact in hand.
  expect(inverse({ verb: "trash", id: "install" }))
    .toEqual([{ verb: "untrash", id: "install", parent: "kitchen" }])
  expect(inverse({ verb: "remove", id: "handles" }))
    .toEqual([{ verb: "untrash", id: "handles", parent: "install" }])
  // A row at top level has no parent to come back under, so its FILE is the
  // recorded fact — the same pair the op takes.
  expect(inverse({ verb: "trash", id: "loose" }))
    .toEqual([{ verb: "untrash", id: "loose", file: "house.olai" }])
})

test("a split is taken back by merging the half it made", () => {
  // One edit, and the ops layer's own opposite rather than one assembled here.
  // `applied` is the new node, which is the only id an inverse ever names that
  // did not exist when the reading was taken.
  expect(inverse({ verb: "split", id: "order", title: "order ", rest: "the cabinets" }, "n1"))
    .toEqual([{ verb: "merge", id: "n1" }])
})

test("an `under` split is taken back the same way — the first child merges into its parent", () => {
  // The tail went UNDER the head — it is the head's first child, so the
  // merge that takes it back is the parent join `merging` now answers. One
  // edit either way, and no two-step window in which the joined title and
  // the still-standing tail read as the same words twice (review of #493).
  expect(
    inverse({ verb: "split", id: "order", title: "order ", rest: "the cabinets", under: true }, "n1"),
  ).toEqual([{ verb: "merge", id: "n1" }])
})

test("a merge is taken back by a whole sequence, and every step is already a verb", () => {
  // `install` merges into `order`, which is `doing`, dated, and carries a note.
  // None of those is copied anywhere by the merge — they are on the two records
  // — so the way back is: the record out of the trash, back into its place, its
  // child back under it, and the survivor's two texts put back GUARDED by what
  // the merge made them.
  expect(inverse({ verb: "merge", id: "install" })).toEqual([
    { verb: "untrash", id: "install", parent: "kitchen" },
    { verb: "place", id: "install", parent: "kitchen", after: "order" },
    { verb: "place", id: "handles", parent: "install", after: null },
    {
      verb: "title",
      id: "order",
      title: "order the cabinets",
      was: "order the cabinetsinstall them",
    },
  ])
})

test("a merge that carried NOTHING leaves the survivor's title alone — and says so by editing nothing", () => {
  // The erased-title Backspace (the human's report on #493): the join added
  // nothing to `order`, so there is no text write to take back — the same
  // rule the note arm one test down states for a note nothing moved. The
  // record comes back with the title it always had, because the archive
  // never let go of it.
  expect(inverse({ verb: "merge", id: "install", title: "" })).toEqual([
    { verb: "untrash", id: "install", parent: "kitchen" },
    { verb: "place", id: "install", parent: "kitchen", after: "order" },
    { verb: "place", id: "handles", parent: "install", after: null },
  ])
})

test("an erased FIRST CHILD's merge is taken back to the top of its old list", () => {
  // `handles` is install's first child: the untrash lands it LAST, the place
  // then names the top of the list — `after: null` — the parent-join slot.
  expect(inverse({ verb: "merge", id: "handles", title: "" })).toEqual([
    { verb: "untrash", id: "handles", parent: "install" },
    { verb: "place", id: "handles", parent: "install", after: null },
  ])
})

test("a merge that MOVED the note puts the note back too, and one that did not says nothing", () => {
  const notes = reading(setOf({
    "house.olai": [
      `{"id":"a","ord":"a0","title":"a","desc":"the first"}`,
      `{"id":"b","ord":"a1","title":"b","desc":"the second"}`,
    ].join("\n"),
  }))
  expect(inverse({ verb: "merge", id: "b" }, "a", notes).at(-1)).toEqual({
    verb: "desc",
    id: "a",
    desc: "the first",
    was: "the first\n\nthe second",
  })
  // `install` has no note of its own, so `order`'s is untouched and a second
  // write would be one that says `was` for a field nothing changed.
  expect(inverse({ verb: "merge", id: "install" }).some((edit) => edit.verb === "desc"))
    .toBe(false)
})

test("a parent merge is taken back with the child put back FIRST under it", () => {
  // `demo` is `kitchen`'s first child: the unarchive lands it LAST, so the
  // place that follows must name the top of the list — `after: null` — never
  // `after: kitchen`, which is the survivor's own id and no slot in its list.
  expect(inverse({ verb: "merge", id: "demo" })).toEqual([
    { verb: "untrash", id: "demo", parent: "kitchen" },
    { verb: "place", id: "demo", parent: "kitchen", after: null },
    {
      verb: "title",
      id: "kitchen",
      title: "Kitchen remodel",
      was: "Kitchen remodeldemolition",
    },
  ])
})

test("a merge that would refuse has nothing to take back", () => {
  // A placement: the one refusal `merge` answers with. There is no write,
  // so there is no inverse.
  expect(inverse({ verb: "merge", id: "echo" })).toEqual([])
})

test("what nothing would take back says so with an empty list", () => {
  // ONE write answers that way now. An `unmirror` could be undone in
  // principle — put the placement back — and this surface has no verb that
  // creates one, so inventing a browser-only mirror-create to serve an undo
  // would be the deviation the menu's verbs exist to close.
  expect(inverse({ verb: "unmirror", id: "echo" })).toEqual([])
})

// ── the two edges ──────────────────────────────────────────────────────

/** A set whose nodes already carry both kinds of edge, so the arms below are
 *  asked about a list that exists rather than about an empty one. */
const EDGED = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true,"see":["demo","install"],"after":["demo"]}`,
  `{"id":"demo","parent":"kitchen","ord":"a1","title":"demolition","todo":true}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","todo":true}`,
  `{"id":"echo","ord":"a1","mirror":"order"}`,
].join("\n")

const edged = (): Reading => reading(setOf({ "house.olai": EDGED }))

test("an edge write travels as the op's own two lists, and resolves nothing", () => {
  expect(asked({ verb: "see", id: "order", add: ["kitchen"] }, edged()))
    .toEqual({ op: "see", id: "order", add: ["kitchen"] })
  expect(asked({ verb: "see", id: "order", remove: ["demo"] }, edged()))
    .toEqual({ op: "see", id: "order", remove: ["demo"] })
  expect(asked({ verb: "after", id: "install", add: ["order"] }, edged()))
    .toEqual({ op: "after", id: "install", add: ["order"] })
  // Both at once is one op, and an absent list stays ABSENT rather than
  // travelling as `undefined` — the spelling every optional field here keeps.
  expect(
    asked({ verb: "after", id: "order", add: ["install"], remove: ["demo"] }, edged()),
  ).toEqual({ op: "after", id: "order", add: ["install"], remove: ["demo"] })
})

test("an edge write fences nothing here — every rule is the planner's", () => {
  // A call that names neither list is spellable on the wire and refused by the
  // ops layer in its own words, which is the sentence an agent gets. The
  // resolver must not answer it first, or the two faces would refuse for
  // different reasons.
  expect(asked({ verb: "see", id: "order" }, edged()))
    .toEqual({ op: "see", id: "order" })
  // …and so is an id nothing declares, and a loop.
  expect(asked({ verb: "see", id: "nobody", add: ["order"] }, edged()))
    .toEqual({ op: "see", id: "nobody", add: ["order"] })
  expect(asked({ verb: "after", id: "demo", add: ["order"] }, edged()))
    .toEqual({ op: "after", id: "demo", add: ["order"] })
})

test("an edge write is taken back by the same verb with its lists swapped", () => {
  expect(inverse({ verb: "see", id: "order", add: ["kitchen"] }, "order", edged()))
    .toEqual([{ verb: "see", id: "order", remove: ["kitchen"] }])
  expect(inverse({ verb: "see", id: "order", remove: ["demo"] }, "order", edged()))
    .toEqual([{ verb: "see", id: "order", add: ["demo"] }])
  expect(
    inverse(
      { verb: "after", id: "order", add: ["install"], remove: ["demo"] },
      "order",
      edged(),
    ),
  ).toEqual([{ verb: "after", id: "order", add: ["demo"], remove: ["install"] }])
})

test("the inverse is what the write CHANGES, read off the set and not off the call", () => {
  // Adding a target the node already sees changes nothing for that target, so
  // undoing it must not drop an edge that was there before the write. Spelled
  // off the request instead, this would answer `remove: ["demo"]` and take away
  // a reference nobody asked about.
  expect(
    inverse({ verb: "see", id: "order", add: ["demo", "kitchen"] }, "order", edged()),
  ).toEqual([{ verb: "see", id: "order", remove: ["kitchen"] }])
  // …and the same read backwards: removing one that was never there.
  expect(
    inverse({ verb: "see", id: "order", remove: ["kitchen", "demo"] }, "order", edged()),
  ).toEqual([{ verb: "see", id: "order", add: ["demo"] }])
})

test("an edge write that would change nothing has nothing to take back", () => {
  // The planner refuses it a moment later ("already sees exactly …"), so the
  // stack must not grow an entry whose replay would be refused too.
  expect(inverse({ verb: "see", id: "order", add: ["demo"] }, "order", edged()))
    .toEqual([])
  expect(inverse({ verb: "see", id: "order" }, "order", edged())).toEqual([])
  // A MIRROR carries no edges of its own, and an id nothing declares has none
  // to read — both are the ops layer's to refuse.
  expect(inverse({ verb: "see", id: "echo", add: ["demo"] }, "echo", edged()))
    .toEqual([])
  expect(inverse({ verb: "after", id: "nobody", add: ["demo"] }, "nobody", edged()))
    .toEqual([])
})

// ── the documents' three, and the outline's one ────────────────────────

const NOTES = "# Notes\n\nwhat was here\n"
const vault = (): Reading =>
  reading(
    setOf({ "house.olai": HOUSE }, [
      ["notes.md", NOTES],
      "Daily/2026/08/2026-08-12.md",
    ]),
  )

test("a document commit travels as it was typed, `was` and all", () => {
  expect(
    asked({ verb: "doc", file: "notes.md", text: "new", was: NOTES }, vault()),
  ).toEqual({ op: "doc", file: "notes.md", text: "new", was: NOTES })
  // No `was` is the overwrite, and the field stays absent rather than
  // travelling as `undefined` — the same spelling the text verbs keep.
  expect(asked({ verb: "doc", file: "notes.md", text: "new" }, vault()))
    .toEqual({ op: "doc", file: "notes.md", text: "new" })
})

test("a new document names its path outright", () => {
  expect(asked({ verb: "docNew", file: "ideas.md" }, vault()))
    .toEqual({ op: "create-doc", file: "ideas.md" })
})

test("a docDay resolves to the vault's own convention, read off this set", () => {
  expect(asked({ verb: "docDay", date: "2026-09-01" }, vault()))
    .toEqual({ op: "create-doc", file: "Daily/2026/09/2026-09-01.md" })
  // A vault with no daily note yet starts the convention at the root.
  expect(asked({ verb: "docDay", date: "2026-09-01" }))
    .toEqual({ op: "create-doc", file: "2026-09-01.md" })
})

test("a docDay that is not a day is refused about the DATE, not the path", () => {
  const failure = refused({ verb: "docDay", date: "someday" }, vault())
  expect(failure.message).toContain("someday")
  expect(failure.message).toContain("not a day")
})

test("a document commit's inverse is the text it replaced, guarded by what it wrote", () => {
  expect(
    inverse({ verb: "doc", file: "notes.md", text: "new" }, "notes.md", vault()),
  ).toEqual([{ verb: "doc", file: "notes.md", text: NOTES, was: "new" }])
})

test("nothing takes a minted document back — an un-create is not a delete", () => {
  expect(inverse({ verb: "docNew", file: "ideas.md" }, "ideas.md", vault()))
    .toEqual([])
  expect(
    inverse({ verb: "docDay", date: "2026-09-01" }, "x.md", vault()),
  ).toEqual([])
})

test("a fileDelete asks for the op, word for word — the guards are the planner's", () => {
  expect(asked({ verb: "fileDelete", file: "ideas.md" }, vault()))
    .toEqual({ op: "delete", file: "ideas.md" })
  // …and judged LITERALLY: a `..` or a served `.html` carries through for the
  // planner's own refusal, exactly as every other verb's path does — the wire
  // does not know a rule the op does not.
  expect(asked({ verb: "fileDelete", file: "../escape.md" }))
    .toEqual({ op: "delete", file: "../escape.md" })
})

test("a deleted file has no inverse — the restore is git's", () => {
  expect(inverse({ verb: "fileDelete", file: "ideas.md" }, "ideas.md", vault()))
    .toEqual([])
})

test("a new outline names its path outright, and the op judges it", () => {
  expect(asked({ verb: "outlineNew", file: "plans.olai" }))
    .toEqual({ op: "create", file: "plans.olai" })
  // Nothing about the path is checked HERE: a `..`, a `.md`, a file the set
  // already holds are each `create_outline`'s own refusal, in its own words.
  expect(asked({ verb: "outlineNew", file: "../escape.olai" }))
    .toEqual({ op: "create", file: "../escape.olai" })
  expect(asked({ verb: "outlineNew", file: "house.olai" }))
    .toEqual({ op: "create", file: "house.olai" })
})

test("nothing takes a minted outline back either", () => {
  expect(inverse({ verb: "outlineNew", file: "plans.olai" }, "plans.olai"))
    .toEqual([])
})

/** The one write on this surface that nothing anywhere undoes — said by
 *  answering nothing, rather than by leaving a ⌘Z that quietly does the wrong
 *  thing. `unmirror` is the other silent arm and its silence is about a shape
 *  this surface cannot spell; this one is about records that have left the set,
 *  which no op reaches. */
test("nothing takes an emptied trash back, and it says so by answering nothing", () => {
  const at = reading(setOf({ "house.olai": HOUSE, "_olai/Trash.olai": ARCHIVED }))
  expect(inverse({ verb: "emptyTrash" }, "_olai/Trash.olai", at)).toEqual([])
})
