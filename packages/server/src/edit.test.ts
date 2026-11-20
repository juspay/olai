const INBOX = `_olai/${INBOX_STEM}.olai`
const PINS = `_olai/${PINS_STEM}.olai`
import {
  INBOX as INBOX_STEM,
  mintedInto,
  type OpFailure,
  type OutlineSet,
  PINS as PINS_STEM,
  type Reading,
} from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { Request } from "@olai/ops"
import type { Edit } from "@olai/surface"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { inverseOf, requestFor } from "@olai/edit-intents"

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

const asked = (edit: Edit, at: Reading = reading()): Request => {
  const outcome = requestFor({ ...at, outlineRow: "outline-olai" }, edit)
  if (Result.isFailure(outcome)) {
    throw new Error(
      `expected \`${edit.verb}\` to resolve, and it refused: ` +
        `${outcome.failure._tag} — ${outcome.failure.message}`,
    )
  }
  return outcome.success
}

const refused = (edit: Edit, at: Reading = reading()): OpFailure => {
  const outcome = requestFor({ ...at, outlineRow: "outline-olai" }, edit)
  if (Result.isSuccess(outcome)) {
    throw new Error(`expected \`${edit.verb}\` to be refused, and it resolved`)
  }
  return outcome.failure
}

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
  expect(asked({ verb: "add", at: { kind: "after", id: "echo" }, title: "x" }))
    .toEqual({ op: "add", file: "house.olai", after: "echo", title: "x" })
})

test("a new row after a node nothing declares is not found", () => {
  expect(refused({ verb: "add", at: { kind: "after", id: "ghost" }, title: "x" })._tag)
    .toBe("NotFoundFailure")
})

test("a capture into a directory with an inbox is an `add` into that file", () => {
  const set = setOf({ "house.olai": HOUSE, [INBOX]: "" })
  expect(asked({ verb: "capture", title: "buy milk" }, reading(set)))
    .toEqual({ op: "add", file: INBOX, title: "buy milk", mark: "todo" })
})

test("a capture into a directory with NO inbox mints one under `_olai/`", () => {
  expect(asked({ verb: "capture", title: "buy milk" }))
    .toEqual({
      op: "create",
      file: INBOX,
      seed: { title: "buy milk", mark: "todo" },
    })
  expect(INBOX).toBe("_olai/Inbox.olai")
})

test("an inbox the directory already keeps with a differently cased stem is used", () => {
  const set = setOf({ "house.olai": HOUSE, "_olai/inbox.olai": "" })
  expect(asked({ verb: "capture", title: "buy milk" }, reading(set)))
    .toEqual({ op: "add", file: "_olai/inbox.olai", title: "buy milk", mark: "todo" })
})

test("a namesake outside _olai does not compete with its inbox", () => {
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
      file: INBOX,
      seed: { title: "buy milk", mark: "todo" },
    })
})

test("a blank capture is left to the ops layer, which has the words for it", () => {
  expect(asked({ verb: "capture", title: "   " }))
    .toEqual({
      op: "create",
      file: INBOX,
      seed: { title: "   ", mark: "todo" },
    })
})

test("a pin into a directory with a shelf is an `add` into that file", () => {
  const set = setOf({ "house.olai": HOUSE, [PINS]: "" })
  expect(asked({ verb: "pin", at: "/#order" }, reading(set)))
    .toEqual({ op: "add", file: PINS, title: "/#order" })
})

test("a pin into a directory with NO shelf mints one under `_olai/`", () => {
  expect(asked({ verb: "pin", at: "/agenda?q=is%3Atodo" }))
    .toEqual({
      op: "create",
      file: PINS,
      seed: { title: "/agenda?q=is%3Atodo" },
    })
  expect(PINS).toBe("_olai/Pins.olai")
})

test("…and a shelf the directory already has is found by its stem under _olai", () => {
  for (const held of [PINS, "_olai/pins.olai", "_olai/Pins.olai"]) {
    const set = setOf({ "house.olai": HOUSE, [held]: "" })
    expect(asked({ verb: "pin", at: "/today" }, reading(set)))
      .toEqual({ op: "add", file: held, title: "/today" })
  }
})

test("a shelf the directory already keeps with a differently cased stem is used", () => {
  const set = setOf({ "house.olai": HOUSE, "_olai/pins.olai": "" })
  expect(asked({ verb: "pin", at: "/today" }, reading(set)))
    .toEqual({ op: "add", file: "_olai/pins.olai", title: "/today" })
})

test("a pin names NO anchor, so it lands last on the shelf", () => {
  const set = setOf({ "house.olai": HOUSE, [PINS]: `{"id":"p","ord":"a0","title":"/today"}` })
  expect(asked({ verb: "pin", at: "/agenda" }, reading(set)))
    .toEqual({ op: "add", file: PINS, title: "/agenda" })
})

test("the address is carried VERBATIM — nothing on the way parses one", () => {
  expect(asked({ verb: "pin", at: "/a b.olai" }))
    .toEqual({ op: "create", file: PINS, seed: { title: "/a b.olai" } })
})

test("a pin that carried a NAME lands as the link `Pins.olai` spells one with", () => {
  const set = setOf({ "house.olai": HOUSE, [PINS]: "" })
  expect(asked({ verb: "pin", at: "/agenda?q=is%3Atodo", name: "What is late" }, reading(set)))
    .toEqual({ op: "add", file: PINS, title: "[What is late](/agenda?q=is%3Atodo)" })
  expect(asked({ verb: "pin", at: "/agenda?q=is%3Atodo", name: "What is late" }))
    .toEqual({
      op: "create",
      file: PINS,
      seed: { title: "[What is late](/agenda?q=is%3Atodo)" },
    })
})

test("a BLANK name is the bare pin — naming nothing is what it always was", () => {
  const set = setOf({ "house.olai": HOUSE, [PINS]: "" })
  for (const name of ["", "   "]) {
    expect(asked({ verb: "pin", at: "/#order", name }, reading(set)))
      .toEqual({ op: "add", file: PINS, title: "/#order" })
  }
})

test("a name the link's grammar cannot hold is REFUSED, and nothing is written", () => {
  const failure = refused({ verb: "pin", at: "/#order", name: "late] things" })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("]")
})

test("Tab goes under the sibling above, last among its children", () => {
  expect(asked({ verb: "move", id: "install", how: "in" }))
    .toEqual({ op: "move", id: "install", parent: "order" })
})

test("Tab on the first of its siblings has nothing to go under", () => {
  const failure = refused({ verb: "move", id: "demo", how: "in" })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("no row above to indent under")
})

test("Shift+Tab goes up a level, immediately after the old parent", () => {
  expect(asked({ verb: "move", id: "handles", how: "out" }))
    .toEqual({ op: "move", id: "handles", parent: "kitchen", after: "install" })
})

test("the picker's move names the parent it was given, and nothing else", () => {
  expect(asked({ verb: "under", id: "handles", parent: "order" }))
    .toEqual({ op: "move", id: "handles", parent: "order" })
})

test("a destination this resolver cannot judge is passed through to the PLANNER", () => {
  expect(asked({ verb: "under", id: "handles", parent: "echo" }))
    .toEqual({ op: "move", id: "handles", parent: "echo" })
})

test("Shift+Tab one level down lands at top level, spelled `null`", () => {
  expect(asked({ verb: "move", id: "demo", how: "out" }))
    .toEqual({ op: "move", id: "demo", parent: null, after: "kitchen" })
})

test("Shift+Tab at the top level is refused", () => {
  expect(refused({ verb: "move", id: "kitchen", how: "out" }).message)
    .toContain("Already at the top level")
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
    .toContain("mirrors a row that isn't loaded")
})

test("a MIRROR moves as itself — a placement is a row a reader can reorder", () => {
  expect(asked({ verb: "move", id: "echo", how: "up" }))
    .toEqual({ op: "move", id: "echo", before: "loose" })
})

test("moving a row nothing declares is not found", () => {
  expect(refused({ verb: "move", id: "ghost", how: "up" })._tag).toBe("NotFoundFailure")
})

test("toggling reads the stored mark rather than being told it", () => {
  expect(asked({ verb: "toggle", id: "install", mark: "done" }))
    .toEqual({ op: "done", id: "install" })
  expect(asked({ verb: "toggle", id: "order", mark: "done" }))
    .toEqual({ op: "done", id: "order" })
  expect(asked({ verb: "toggle", id: "demo", mark: "done" }))
    .toEqual({ op: "done", id: "demo", undo: true })
})

const marked = (id: string, mark: string): Reading => {
  const line = HOUSE.split("\n").find((one) => one.includes(`"id":"${id}"`))
  if (line === undefined) throw new Error(`no \`${id}\` in the fixture`)
  return reading(setOf({
    "house.olai": HOUSE.replace(line, `${line.slice(0, -1)},"${mark}":true}`),
  }))
}

test("the walk goes bullet → todo → doing → bullet, one op a step", () => {
  expect(asked({ verb: "walk", id: "install" })).toEqual({ op: "todo", id: "install" })
  expect(asked({ verb: "walk", id: "install" }, marked("install", "todo")))
    .toEqual({ op: "doing", id: "install" })
  expect(asked({ verb: "walk", id: "order" }))
    .toEqual({ op: "doing", id: "order", undo: true })
})

test("the walk asks a done node for `todo`, and the ops layer is what says no", () => {
  expect(asked({ verb: "walk", id: "demo" })).toEqual({ op: "todo", id: "demo" })
})

test("a walk on a mirror steps from the mark that row DRAWS, and keeps its id", () => {
  expect(asked({ verb: "walk", id: "echo" }))
    .toEqual({ op: "doing", id: "echo", undo: true })
})

test("a walk on a node nothing declares is not found", () => {
  expect(refused({ verb: "walk", id: "ghost" })._tag).toBe("NotFoundFailure")
})

test("an id the CALLER named travels as it is, mirror or not", () => {
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

test("what a text edit expects to find travels WITH the request", () => {
  expect(
    asked({ verb: "title", id: "order", title: "put it back", was: "order the cabinets" }),
  ).toEqual({ op: "title", id: "order", title: "put it back", was: "order the cabinets" })
})

test("a note's condition travels too, `null` and all", () => {
  expect(asked({ verb: "desc", id: "install", desc: "measure first", was: null }))
    .toEqual({ op: "desc", id: "install", desc: "measure first", was: null })
})

test("no condition is what a person typing sends, and it stays absent", () => {
  expect(asked({ verb: "title", id: "order", title: "anything" }))
    .toEqual({ op: "title", id: "order", title: "anything" })
  expect("was" in asked({ verb: "title", id: "order", title: "anything" })).toBe(false)
})

test("a property's condition travels too — `null` expecting the key GONE", () => {
  expect(asked({ verb: "prop", id: "order", key: "pr", value: "https://x/2", was: "https://x/1" }))
    .toEqual({ op: "prop", id: "order", key: "pr", value: "https://x/2", was: "https://x/1" })
  expect(asked({ verb: "prop", id: "order", key: "stage", value: "review", was: null }))
    .toEqual({ op: "prop", id: "order", key: "stage", value: "review", was: null })
  expect(asked({ verb: "prop", id: "order", key: "pr", value: "anything" }))
    .toEqual({ op: "prop", id: "order", key: "pr", value: "anything" })
  expect("was" in asked({ verb: "prop", id: "order", key: "pr", value: "anything" })).toBe(false)
})

test("a mark named outright is that mark's own op", () => {
  expect(asked({ verb: "mark", id: "install", mark: "todo" }))
    .toEqual({ op: "todo", id: "install" })
  expect(asked({ verb: "mark", id: "demo", mark: "doing" }))
    .toEqual({ op: "doing", id: "demo" })
})

test("clearing a mark is the STORED one's op, undone", () => {
  expect(asked({ verb: "mark", id: "demo", mark: null }))
    .toEqual({ op: "done", id: "demo", undo: true })
  expect(asked({ verb: "mark", id: "order", mark: null }))
    .toEqual({ op: "doing", id: "order", undo: true })
})

test("clearing a mark from a node that carries none says so", () => {
  const failure = refused({ verb: "mark", id: "install", mark: null })
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toContain("carries no mark")
})

test("a mark on a mirror travels as the caller named it", () => {
  expect(asked({ verb: "mark", id: "echo", mark: "doing" }))
    .toEqual({ op: "doing", id: "echo" })
})

test("a mark on a node nothing declares is not found", () => {
  expect(refused({ verb: "mark", id: "ghost", mark: null })._tag).toBe("NotFoundFailure")
})

test("a date is the op's own field, clear and set alike", () => {
  expect(asked({ verb: "date", id: "order", date: null }))
    .toEqual({ op: "date", id: "order", date: null })
  expect(asked({ verb: "date", id: "order", date: "2026-09-01" }))
    .toEqual({ op: "date", id: "order", date: "2026-09-01" })
})

test("a repeat rule is the op's own field, set and stopped alike", () => {
  expect(asked({ verb: "repeat", id: "order", repeat: "every week on monday" }))
    .toEqual({ op: "repeat", id: "order", repeat: "every week on monday" })
  expect(asked({ verb: "repeat", id: "order", repeat: null }))
    .toEqual({ op: "repeat", id: "order", repeat: null })
})

test("completing a repeating row asks for exactly what `outlines_done` asks for", () => {
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
  expect(asked({ verb: "unmirror", id: "kitchen" }))
    .toEqual({ op: "unmirror", id: "kitchen" })
})

test("unarchive passes through, destination and all — the chain is the op's to follow", () => {
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
  expect(asked({ verb: "trash", id: "kitchen" }))
    .toEqual({ op: "trash", id: "kitchen" })
})

test("duplicate is the op and nothing else — the copy is the op's to build", () => {
  expect(asked({ verb: "duplicate", id: "install" }))
    .toEqual({ op: "duplicate", id: "install" })
})

test("a duplicate through a placement is refused where every other op refuses one", () => {
  expect(asked({ verb: "duplicate", id: "echo" }))
    .toEqual({ op: "duplicate", id: "echo" })
})

test("putting a row back names the parent it was given and the sibling above", () => {
  expect(asked({ verb: "place", id: "handles", parent: "kitchen", after: "demo" }))
    .toEqual({ op: "move", id: "handles", parent: "kitchen", after: "demo" })
})

test("back to the FRONT of a branch is `before` whatever is first NOW", () => {
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

test("back to the top level of ANOTHER outline names that outline", () => {
  const set = setOf({
    "house.olai": HOUSE,
    "garden.olai": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  })
  expect(
    asked({ verb: "place", id: "herbs", parent: null, file: "house.olai", after: null }, reading(set)),
  ).toEqual({ op: "move", id: "herbs", parent: null, file: "house.olai", before: "kitchen" })
})

test("...and with a parent the file decides nothing, so it does not travel", () => {
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

test("a split carries the two texts and resolves nothing else", () => {
  expect(asked({ verb: "split", id: "order", title: "order ", rest: "the cabinets" }))
    .toEqual({ op: "split", id: "order", title: "order ", rest: "the cabinets" })
})

test("a merge names the row and nothing else — the sibling above is the set's", () => {
  expect(asked({ verb: "merge", id: "install" })).toEqual({ op: "merge", id: "install" })
})

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
  const at = reading(setOf({
    "house.olai": HOUSE,
    "_olai/Trash.olai": "",
  }))
  const failure = refused({ verb: "emptyTrash" }, at)
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toBe("The Trash is already empty")
})

test("the count the confirm showed travels, and is never re-derived here", () => {
  const at = reading(setOf({ "house.olai": HOUSE, "_olai/Trash.olai": ARCHIVED }))
  expect(asked({ verb: "emptyTrash", was: 9 }, at))
    .toEqual({ op: "empty", file: "_olai/Trash.olai", was: 9 })
})

test("an empty trash is refused HERE, in terms of the trash", () => {
  const failure = refused({ verb: "emptyTrash" }, reading())
  expect(failure._tag).toBe("UsageFailure")
  expect(failure.message).toBe("The Trash is already empty")
})

const inverse = (
  edit: Edit,
  applied = "minted",
  at: Reading = reading(),
): ReadonlyArray<Edit> => inverseOf(at, edit, asked(edit, at), applied)

test("a move records where the row SAT — its parent, and the row above it", () => {
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
  expect(inverse({ verb: "move", id: "loose", how: "in" }))
    .toEqual([{ verb: "place", id: "loose", parent: null, file: "house.olai", after: "kitchen" }])
})

test("the picker's move records the place it leaves, like every other one", () => {
  expect(inverse({ verb: "under", id: "install", parent: "loose" }))
    .toEqual([{ verb: "place", id: "install", parent: "kitchen", file: "house.olai", after: "order" }])
})

test("an undo is itself undoable: a place records the place it leaves", () => {
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
  expect(inverse({ verb: "toggle", id: "order", mark: "done" }))
    .toEqual([
      { verb: "mark", id: "order", mark: null },
      { verb: "mark", id: "order", mark: "doing" },
    ])
})

test("a walk is taken back by the mark it stepped off, in ONE call", () => {
  expect(inverse({ verb: "walk", id: "install" }))
    .toEqual([{ verb: "mark", id: "install", mark: null }])
  expect(inverse({ verb: "walk", id: "install" }, "minted", marked("install", "todo")))
    .toEqual([{ verb: "mark", id: "install", mark: "todo" }])
  expect(inverse({ verb: "walk", id: "order" }))
    .toEqual([{ verb: "mark", id: "order", mark: "doing" }])
})

test("taking a mark OFF is put back by putting it on, and nothing else", () => {
  expect(inverse({ verb: "mark", id: "order", mark: null }))
    .toEqual([{ verb: "mark", id: "order", mark: "doing" }])
})

test("a mark chosen outright says for itself whether the way back is two", () => {
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
  expect(inverse({ verb: "desc", id: "order", desc: null }))
    .toEqual([{ verb: "desc", id: "order", desc: "oak, or birch", was: null }])
})

test("undoing a text edit is undoable in its turn — the pair, the other way round", () => {
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
  expect(inverse({ verb: "title", id: "echo", title: "x" })).toEqual([])
})

test("a cleared date is put back as the date it cleared", () => {
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
  expect(inverse({ verb: "repeat", id: "install", repeat: "every day" }))
    .toEqual([{ verb: "repeat", id: "install", repeat: null }])
  expect(inverse({ verb: "repeat", id: "echo", repeat: null })).toEqual([])
})

test("a property is put back as the value it held, conditional on the write's own shape", () => {
  expect(inverse({ verb: "prop", id: "order", key: "pr", value: null }))
    .toEqual([{ verb: "prop", id: "order", key: "pr", value: "https://x/1", was: null }])
  expect(inverse({ verb: "prop", id: "install", key: "stage", value: "review" }))
    .toEqual([{ verb: "prop", id: "install", key: "stage", value: null, was: "review" }])
  expect(inverse({ verb: "prop", id: "order", key: "pr", value: "" }))
    .toEqual([{ verb: "prop", id: "order", key: "pr", value: "https://x/1", was: null }])
})

test("a property holding a LIST has no inverse, rather than a wrong one", () => {
  expect(inverse({ verb: "prop", id: "order", key: "tags", value: null })).toEqual([])
})

test("a duplicate is taken back by putting the COPY away, never the original", () => {
  expect(inverse({ verb: "duplicate", id: "install" }, "copy"))
    .toEqual([{ verb: "trash", id: "copy" }])
})

test("an archive records the place the row is about to stop having", () => {
  expect(inverse({ verb: "trash", id: "install" }))
    .toEqual([{ verb: "untrash", id: "install", parent: "kitchen" }])
  expect(inverse({ verb: "remove", id: "handles" }))
    .toEqual([{ verb: "untrash", id: "handles", parent: "install" }])
  expect(inverse({ verb: "trash", id: "loose" }))
    .toEqual([{ verb: "untrash", id: "loose", file: "house.olai" }])
})

test("a split is taken back by merging the half it made", () => {
  expect(inverse({ verb: "split", id: "order", title: "order ", rest: "the cabinets" }, "n1"))
    .toEqual([{ verb: "merge", id: "n1" }])
})

test("an `under` split is taken back the same way — the first child merges into its parent", () => {
  expect(
    inverse({ verb: "split", id: "order", title: "order ", rest: "the cabinets", under: true }, "n1"),
  ).toEqual([{ verb: "merge", id: "n1" }])
})

test("an `under` split's ⌘Z ⌘⇧Z is a round trip — the tail comes back FIRST", () => {
  const undo = inverse(
    { verb: "split", id: "install", title: "install", rest: " them", under: true },
    "handles",
  )
  expect(undo).toEqual([{ verb: "merge", id: "handles" }])
  const redo = inverse({ verb: "merge", id: "handles" })
  expect(redo.find((edit) => edit.verb === "place")).toEqual({
    verb: "place",
    id: "handles",
    parent: "install",
    after: null,
  })
})

test("a merge is taken back by a whole sequence, and every step is already a verb", () => {
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
  expect(inverse({ verb: "merge", id: "install", title: "" })).toEqual([
    { verb: "untrash", id: "install", parent: "kitchen" },
    { verb: "place", id: "install", parent: "kitchen", after: "order" },
    { verb: "place", id: "handles", parent: "install", after: null },
  ])
})

test("an erased FIRST CHILD's merge is taken back to the top of its old list", () => {
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
  expect(inverse({ verb: "merge", id: "install" }).some((edit) => edit.verb === "desc"))
    .toBe(false)
})

test("a parent merge is taken back with the child put back FIRST under it", () => {
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
  expect(inverse({ verb: "merge", id: "echo" })).toEqual([])
})

test("what nothing would take back says so with an empty list", () => {
  expect(inverse({ verb: "unmirror", id: "echo" })).toEqual([])
})

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
  expect(
    asked({ verb: "after", id: "order", add: ["install"], remove: ["demo"] }, edged()),
  ).toEqual({ op: "after", id: "order", add: ["install"], remove: ["demo"] })
})

test("an edge write fences nothing here — every rule is the planner's", () => {
  expect(asked({ verb: "see", id: "order" }, edged()))
    .toEqual({ op: "see", id: "order" })
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
  expect(
    inverse({ verb: "see", id: "order", add: ["demo", "kitchen"] }, "order", edged()),
  ).toEqual([{ verb: "see", id: "order", remove: ["kitchen"] }])
  expect(
    inverse({ verb: "see", id: "order", remove: ["kitchen", "demo"] }, "order", edged()),
  ).toEqual([{ verb: "see", id: "order", add: ["demo"] }])
})

test("an edge write that would change nothing has nothing to take back", () => {
  expect(inverse({ verb: "see", id: "order", add: ["demo"] }, "order", edged()))
    .toEqual([])
  expect(inverse({ verb: "see", id: "order" }, "order", edged())).toEqual([])
  expect(inverse({ verb: "see", id: "echo", add: ["demo"] }, "echo", edged()))
    .toEqual([])
  expect(inverse({ verb: "after", id: "nobody", add: ["demo"] }, "nobody", edged()))
    .toEqual([])
})

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
  expect(asked({ verb: "doc", file: "notes.md", text: "new" }, vault()))
    .toEqual({ op: "doc", file: "notes.md", text: "new" })
})

test("a new document names its path outright", () => {
  expect(asked({ verb: "docNew", file: "ideas.md" }, vault()))
    .toEqual({ op: "create-doc", file: "ideas.md" })
})

test("a document commit's inverse is the text it replaced, guarded by what it wrote", () => {
  expect(
    inverse({ verb: "doc", file: "notes.md", text: "new" }, "notes.md", vault()),
  ).toEqual([{ verb: "doc", file: "notes.md", text: NOTES, was: "new" }])
})

test("nothing takes a minted document back — an un-create is not a delete", () => {
  expect(inverse({ verb: "docNew", file: "ideas.md" }, "ideas.md", vault()))
    .toEqual([])
})

test("a fileDelete asks for the op, word for word — the guards are the planner's", () => {
  expect(asked({ verb: "fileDelete", file: "ideas.md" }, vault()))
    .toEqual({ op: "delete", file: "ideas.md" })
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
  expect(asked({ verb: "outlineNew", file: "../escape.olai" }))
    .toEqual({ op: "create", file: "../escape.olai" })
  expect(asked({ verb: "outlineNew", file: "house.olai" }))
    .toEqual({ op: "create", file: "house.olai" })
})

test("nothing takes a minted outline back either", () => {
  expect(inverse({ verb: "outlineNew", file: "plans.olai" }, "plans.olai"))
    .toEqual([])
})

test("nothing takes an emptied trash back, and it says so by answering nothing", () => {
  const at = reading(setOf({ "house.olai": HOUSE, "_olai/Trash.olai": ARCHIVED }))
  expect(inverse({ verb: "emptyTrash" }, "_olai/Trash.olai", at)).toEqual([])
})

test("emptying refuses two Trash convention files even when one is empty", () => {
  const at = reading(setOf({ "_olai/Trash.olai": ARCHIVED, "_olai/TRASH.olai": "" }))
  const failure = refused({ verb: "emptyTrash" }, at)
  expect(failure.message).toContain("ambiguous-convention")
  expect(failure.message).toContain("_olai/Trash.olai")
  expect(failure.message).toContain("_olai/TRASH.olai")
})
