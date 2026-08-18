/**
 * The five things the move-to picker will not do, and the words it says about
 * each.
 *
 * The rules are the ops layer's (`ops/src/plan.ts`'s `planMove`) read one
 * gesture earlier, so what is worth pinning here is not that they exist — the
 * write would be refused either way — but that the picker says the RIGHT one.
 * Four of the five are true at once about a node in the Trash (it is archived,
 * it is in another file, it is not this row's parent, it is not this row), and
 * a reader who is told the wrong true thing has been told nothing.
 *
 * Pure, over a `Map` of parents, because that is all `whyNot` takes.
 */

import { expect, test } from "bun:test"

import { type Destination, type Moved, whyNot } from "./destination.ts"

/**
 * The fixture, as an ancestry — the browser suite's own `house.olai`, read as
 * the one thing this module asks of a tree:
 *
 *     kitchen → demo
 *             → install → handles, knobs
 *
 * with `herbs` over in `garden.olai` and `old` in an `Archive.olai`.
 */
const PARENTS: ReadonlyMap<string, string> = new Map([
  ["install", "kitchen"],
  ["handles", "install"],
  ["knobs", "install"],
  ["demo", "kitchen"],
])
const parentOf = (id: string): string | undefined => PARENTS.get(id)

/** A node the search offered. `file` defaults to the one the moving row is in,
 *  so a case about something else says so by naming it. */
const at = (id: string, file = "house.olai"): Destination => ({ id, title: id, file })

/** The ordinary row being moved: `install`, an outline node under `kitchen`,
 *  showing itself. */
const INSTALL: Moved = {
  id: "install",
  file: "house.olai",
  shows: "install",
  parent: "kitchen",
}

test("an ordinary destination in the same file is not refused at all", () => {
  expect(whyNot(INSTALL, at("demo"), parentOf)).toBeNull()
})

test("a row cannot go under itself", () => {
  expect(whyNot(INSTALL, at("install"), parentOf)).toContain("the row you are moving")
})

test("...nor under anything inside it, however deep", () => {
  // `handles` is `install`'s child: the move would fold the branch into itself,
  // which is the loop `planMove`'s own `containing` refuses.
  expect(whyNot(INSTALL, at("handles"), parentOf)).toContain("inside the row you are moving")
})

test("a destination in another outline is refused, naming both files", () => {
  const why = whyNot(INSTALL, at("herbs", "garden.olai"), parentOf) ?? ""
  expect(why).toContain("`garden.olai`")
  expect(why).toContain("`house.olai`")
  // The LAW, in the one spelling this app has for it (`../across.ts`) — the
  // same sentence a row dragged over another file's pane is refused with.
  expect(why).toContain("Every outline is an independent tree")
})

test("an archived destination says it is put away, NOT that it is another file", () => {
  // Both are true, and only one of them is the news. This is the ordering the
  // header is about: `Archive.olai` is another file by construction, so a
  // cross-file test asked first would answer every archived row with the wrong
  // sentence.
  const why = whyNot(INSTALL, at("old", "Archive.olai"), parentOf) ?? ""
  expect(why).toContain("put away")
  expect(why).not.toContain("independent tree")
})

test("an archive under a folder is one too", () => {
  // `isArchived` is the format's own (`@olai/format`), which is what keeps this
  // one spelling: an archive is `Archive.olai` at the root or beside any
  // outline under it.
  expect(whyNot(INSTALL, at("old", "notes/Archive.olai"), parentOf)).toContain("put away")
})

test("the row's CURRENT parent is refused, and says what it would have done", () => {
  // The ruling this module's header argues: offered so a reader can find it,
  // refused because it is a reorder rather than a move — a destination puts the
  // row last among its new siblings, and the parent it already has is not a
  // new one.
  const why = whyNot(INSTALL, at("kitchen"), parentOf) ?? ""
  expect(why).toContain("already this row's parent")
  expect(why).toContain("reorder")
})

// ── a MIRROR, which is moved as the placement it is ────────────────────

/** A placement of `install`, sitting under `kitchen` in the same file. Its own
 *  record has no children; what it DRAWS is `install`'s subtree. */
const PLACEMENT: Moved = {
  id: "kitchen-install",
  file: "house.olai",
  shows: "install",
  parent: "kitchen",
}

test("a placement may not be put inside what it shows — it would expand forever", () => {
  // The mirror-cycle the validator refuses ("this mirror is placed inside the
  // subtree it shows, so expanding it never ends"), said at the aim. Asked of
  // what the row DRAWS rather than of its own record, which is the whole
  // difference between this case and the one above: nothing has the placement
  // as a parent, so a walk of its own descendants would find nothing to refuse.
  expect(whyNot(PLACEMENT, at("handles"), parentOf)).toContain("inside what this row shows")
  expect(whyNot(PLACEMENT, at("install"), parentOf)).toContain("inside what this row shows")
})

test("...and may go anywhere else in its file, including under a node it does not show", () => {
  expect(whyNot(PLACEMENT, at("demo"), parentOf)).toBeNull()
})

test("a placement drawing nothing is inside nothing", () => {
  // A chain that died: there is no subtree to be inside, so only the ordinary
  // rules apply. The row is still movable, which is what the `•••` offers.
  const lost: Moved = { id: "lost", file: "house.olai", shows: undefined, parent: "kitchen" }
  expect(whyNot(lost, at("handles"), parentOf)).toBeNull()
})

test("a parent chain that loops is answered rather than walked forever", () => {
  // A set the validator refuses, so this is a frame drawn before that verdict
  // — and a browser that hung on it would take the page with it.
  const looped = new Map([["a", "b"], ["b", "a"]])
  expect(whyNot(INSTALL, at("a"), (id) => looped.get(id))).toBeNull()
})
