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
 * Over a REAL derivation of a real corpus (`derive` + the format's own
 * `setOf`), because the walk this module asks for is the format's own: a `Map`
 * of parents would be a second answer to what an ancestor chain is, in the one
 * test that exists to hold this file to the first.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { type Destination, type Moved, whyNot } from "./destination.ts"

/**
 * The browser suite's own `house.olai`, plus the two files a destination can be
 * refused for being in:
 *
 *     kitchen → demo
 *             → install → handles, knobs
 *
 * with `herbs` over in `garden.olai` and `tiles` put away in an archive that
 * sits under a folder — an archive is `Archive.olai` at the root or beside any
 * outline under it (`@olai/format`'s own rule).
 */
const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}`,
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install the cabinets"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
  `{"id":"knobs","parent":"install","ord":"a1","title":"pick the knobs"}`,
  `{"id":"kitchen-install","parent":"kitchen","ord":"a2","mirror":"install"}`,
].join("\n")

const GARDEN = `{"id":"herbs","ord":"a0","title":"the herb bed"}`
const AWAY = `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`

const derived = derive(
  setOf({
    "house.olai": HOUSE,
    "garden.olai": GARDEN,
    "notes/Archive.olai": AWAY,
  }).nodes,
)

/** A node the search offered, as the three fields a verdict reads — off the
 *  derivation, so a case naming an id the corpus does not hold fails here
 *  rather than passing against a shape invented for it. */
const at = (id: string): Destination => {
  const located = derived.byId.get(id)
  if (located === undefined) throw new Error(`no \`${id}\` in the fixture`)
  return { id, title: "title" in located.node ? located.node.title : id, file: located.file }
}

/** The ordinary row being moved: `install`, an outline node under `kitchen`,
 *  showing itself. */
const INSTALL: Moved = {
  id: "install",
  title: "install the cabinets",
  file: "house.olai",
  shows: "install",
  parent: "kitchen",
}

test("an ordinary destination in the same file is not refused at all", () => {
  expect(whyNot(INSTALL, at("demo"), derived)).toBeNull()
})

test("a row cannot go under itself", () => {
  expect(whyNot(INSTALL, at("install"), derived)).toContain("the row you are moving")
})

test("...nor under anything inside it, however deep", () => {
  // `handles` is `install`'s child: the move would fold the branch into itself,
  // which is the loop `planMove`'s own `containing` refuses.
  expect(whyNot(INSTALL, at("handles"), derived)).toContain("inside the row you are moving")
})

test("a destination in another outline is refused, naming both files", () => {
  const why = whyNot(INSTALL, at("herbs"), derived) ?? ""
  expect(why).toContain("`garden.olai`")
  expect(why).toContain("`house.olai`")
  // The LAW, in the one spelling this app has for it (`../across.ts`) — the
  // same sentence a row dragged over another file's pane is refused with.
  expect(why).toContain("Every outline is an independent tree")
})

test("an archived destination says it is put away, NOT that it is another file", () => {
  // Both are true, and only one of them is the news. This is the ordering the
  // header is about: an archive is another file by construction, so a
  // cross-file test asked first would answer every archived row with the wrong
  // sentence.
  const why = whyNot(INSTALL, at("tiles"), derived) ?? ""
  expect(why).toContain("put away")
  expect(why).not.toContain("independent tree")
})

test("the row's CURRENT parent is refused, and says what it would have done", () => {
  // The ruling this module's header argues: offered so a reader can find it,
  // refused because it is a reorder rather than a move — a destination puts the
  // row last among its new siblings, and the parent it already has is not a
  // new one.
  const why = whyNot(INSTALL, at("kitchen"), derived) ?? ""
  expect(why).toContain("already this row's parent")
  expect(why).toContain("reorder")
})

// ── a MIRROR, which is moved as the placement it is ────────────────────

/** The fixture's placement of `install`, sitting under `kitchen` in the same
 *  file. Its own record has no children; what it DRAWS is `install`'s subtree. */
const PLACEMENT: Moved = {
  id: "kitchen-install",
  title: "install the cabinets",
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
  expect(whyNot(PLACEMENT, at("handles"), derived)).toContain("inside what this row shows")
  expect(whyNot(PLACEMENT, at("install"), derived)).toContain("inside what this row shows")
})

test("...and may go anywhere else in its file, including under a node it does not show", () => {
  expect(whyNot(PLACEMENT, at("demo"), derived)).toBeNull()
})

test("a placement drawing nothing is inside nothing", () => {
  // A chain that died: there is no subtree to be inside, so only the ordinary
  // rules apply. The row is still movable, which is what the `•••` offers.
  const lost: Moved = {
    id: "lost",
    title: "lost",
    file: "house.olai",
    shows: undefined,
    parent: "kitchen",
  }
  expect(whyNot(lost, at("handles"), derived)).toBeNull()
})
