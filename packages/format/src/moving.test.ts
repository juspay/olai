/**
 * The things the move-to picker will not do, and the words it says about each —
 * plus the ANSWER the wire carries them on.
 *
 * The rules are the ops layer's (`@olai/ops`' `plan.ts`'s `planMove`) read one
 * gesture earlier, so what is worth pinning here is not that they exist — the
 * write would be refused either way — but that the picker says the RIGHT one,
 * and that it says NOTHING where the planner would write. Several are true at
 * once about a node in the Trash (it is archived, it is not this row's parent,
 * it is not this row), and a reader who is told the wrong true thing has been
 * told nothing.
 *
 * ONE OF THEM IS GONE, and its absence is tested beside the rest: another
 * outline. `move_node` crosses files now, so a destination this reading dims is
 * a destination the planner would have taken — which is the one thing the
 * header's standing rule forbids.
 *
 * It moved here with the reading (`https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/vault-in-browser.md`'s
 * PR 10): the picker judges an arbitrary node the SEARCH offered against the
 * row being moved, which is a question about the set and about no page, so it
 * is asked over the wire and answered where the records are.
 *
 * Over a REAL derivation of a real corpus, because the walk this module asks
 * for is the format's own: a `Map` of parents would be a second answer to what
 * "inside" means, in the one test that exists to hold this file to the first.
 */

import { expect, test } from "bun:test"

import { derive } from "./derive.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import { type Destination, type Moved, movingOf, whyNot } from "./moving.ts"

/**
 * The browser suite's own `house.olai` plus a NOW SECTION, which is the
 * topology the drawing walk exists for — `ops` documents a Now/Focus list as
 * mirrors of live work, and this is that:
 *
 *     now
 *       now-install     (a mirror of install)
 *     kitchen
 *       demo
 *       install
 *         handles
 *         knobs
 *       kitchen-install (a mirror of install, a sibling of what it shows)
 *
 * with `herbs` over in `garden.olai` and `tiles` put away in an archive that
 * sits under a folder — an archive is `_olai/Trash.olai` at the root or beside any
 * outline under it (`@olai/format`'s own rule).
 */
const HOUSE = [
  `{"id":"now","ord":"a0","title":"Now"}`,
  `{"id":"now-install","parent":"now","ord":"a0","mirror":"install"}`,
  `{"id":"kitchen","ord":"a1","title":"kitchen remodel","doing":true}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}`,
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install the cabinets"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
  `{"id":"knobs","parent":"install","ord":"a1","title":"pick the knobs"}`,
  `{"id":"kitchen-install","parent":"kitchen","ord":"a2","mirror":"install"}`,
].join("\n")

const GARDEN = `{"id":"herbs","ord":"a0","title":"the herb bed"}`
const AWAY = `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`

const derived = derive(
  nodesOfFiles({
    "house.olai": HOUSE,
    "garden.olai": GARDEN,
    "_olai/Trash.olai": AWAY,
  }),
)

/** A node the search offered, as the three fields a verdict reads — off the
 *  derivation, so a case naming an id the corpus does not hold fails here
 *  rather than passing against a shape invented for it. */
const at = (id: string): Destination => {
  const located = derived.byId.get(id)
  if (located === undefined) throw new Error(`no \`${id}\` in the fixture`)
  return { id, title: "title" in located.node ? located.node.title : id, file: located.file }
}

/** A row being moved, by the id of its own record — the title is what the
 *  panel says and no rule judges it, so it is the record's own here. */
const moving = (id: string): Moved => {
  const located = derived.byId.get(id)
  if (located === undefined) throw new Error(`no \`${id}\` in the fixture`)
  return {
    id,
    title: "title" in located.node ? located.node.title : id,
    file: located.file,
    parent: located.node.parent ?? null,
  }
}

const INSTALL = moving("install")

test("an ordinary destination in the same file is not refused at all", () => {
  expect(whyNot(INSTALL, at("demo"), derived)).toBeNull()
})

test("a row cannot go under itself", () => {
  expect(whyNot(INSTALL, at("install"), derived)).toContain("the row you are moving")
})

test("...nor under anything inside it, however deep", () => {
  // `handles` is `install`'s child: the move would fold the branch into itself,
  // which is the loop `planMove`'s own `containing` refuses. A destination the
  // reader can SEE under the row needs no chain to explain it.
  const why = whyNot(INSTALL, at("handles"), derived) ?? ""
  expect(why).toContain("inside the row you are moving")
  expect(why).not.toContain("→")
})

// ── the case a parent walk cannot see ──────────────────────────────────

test("a destination a descendant PLACEMENT draws is refused, naming the chain", () => {
  // THE REVIEW'S FINDING, pinned. `now` holds a mirror of `install`, so moving
  // `now` under `install` draws `now` inside itself for ever — and no parent
  // link says so: `install` is in another branch entirely. Before the drawing
  // walk this was silent here, planned by `planMove`, and refused by the write
  // gate's validator as a `mirror-cycle` about a file nobody wrote.
  const why = whyNot(moving("now"), at("install"), derived) ?? ""
  expect(why).toContain("drawn inside this row, through a placement")
  expect(why).toContain("`now` → `now-install` → `install`")
})

test("...and so is anything under it, however deep", () => {
  const why = whyNot(moving("now"), at("handles"), derived) ?? ""
  expect(why).toContain("through a placement")
  expect(why).toContain("`now` → `now-install` → `install` → `handles`")
})

test("a SIBLING of what the placement shows is not refused", () => {
  // The other half, and what keeps the walk honest rather than merely strict:
  // `kitchen` is where `install` lives, not something `now` draws, so `now`
  // may go there. A rule that refused it would be inventing one.
  expect(whyNot(moving("now"), at("kitchen"), derived)).toBeNull()
  expect(whyNot(moving("now"), at("demo"), derived)).toBeNull()
})

// ── a MIRROR, which is moved as the placement it is ────────────────────

test("a placement may not be put inside what it shows — it would expand forever", () => {
  // The mirror-cycle the validator refuses ("this mirror is placed inside the
  // subtree it shows, so expanding it never ends"), said at the aim. It is the
  // same walk as the case above with one hop fewer: what this ROW draws is its
  // target's whole subtree, so both the target and a child of it are refused.
  expect(whyNot(moving("kitchen-install"), at("install"), derived))
    .toContain("through a placement")
  expect(whyNot(moving("kitchen-install"), at("handles"), derived))
    .toContain("through a placement")
})

test("...and may go anywhere else in its file, including beside what it shows", () => {
  expect(whyNot(moving("kitchen-install"), at("demo"), derived)).toBeNull()
})

// ── the other three refusals ───────────────────────────────────────────

test("a destination in another outline is not refused at all any more", () => {
  // The fence this module used to be most of. `move_node` carries a row and
  // everything under it into another outline with its id
  // (`@olai/ops`' `planMove`), so the picker's search of the whole set now
  // OFFERS what it finds there rather than dimming it — and this reading, whose
  // standing rule is that it must never refuse what the planner would allow,
  // has nothing left to say about a different file.
  expect(whyNot(INSTALL, at("herbs"), derived)).toBeNull()
})

test("an archived destination still says it is put away", () => {
  // The one thing another outline can still be, and the reason the Trash test
  // stands where the cross-file one used to: an archive is an outline like any
  // other to a search, and what the reader needs told is that work put away is
  // not somewhere to move work TO.
  const why = whyNot(INSTALL, at("tiles"), derived) ?? ""
  expect(why).toContain("put away")
  expect(why).toContain("Put back")
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

// ── the ANSWER, which is what actually crosses ─────────────────────────
//
// `whyNot` above is the rule; this is the envelope the picker reads it
// through — the row as the set says it NOW, and a verdict per destination IN
// THE ORDER ASKED. The order is the whole contract: the caller pairs the
// answers back up with the ids it sent, so an answer that reordered them would
// dim the wrong rows.

test("the answer carries the row as the set says it now, and a verdict per destination", () => {
  const said = movingOf(derived, { record: "install", to: ["demo", "handles", "herbs"] })
  expect(said.moved).toEqual({
    id: "install",
    title: "install the cabinets",
    file: "house.olai",
    parent: "kitchen",
  })
  expect(said.refusals).toHaveLength(3)
  expect(said.refusals[0]).toBeNull()
  expect(said.refusals[1]).toContain("inside the row you are moving")
  // …and the third is a node of `garden.olai`, which the picker will now carry
  // the row to: a verdict of `null` is the answer that lets `Enter` write.
  expect(said.refusals[2]).toBeNull()
})

test("a MIRROR is moved as the placement it is, and called by what it shows", () => {
  // The row's own record is what the write names; the title is the node it
  // DRAWS, which is the one thing `follow` is asked for.
  const said = movingOf(derived, { record: "kitchen-install", to: [] })
  expect(said.moved).toEqual({
    id: "kitchen-install",
    title: "install the cabinets",
    file: "house.olai",
    parent: "kitchen",
  })
})

test("a record the set no longer declares answers nothing — which closes the panel", () => {
  expect(movingOf(derived, { record: "gone", to: ["demo"] }))
    .toEqual({ moved: null, refusals: [] })
})

test("a destination the set does not declare is said nothing about, not refused", () => {
  // This is a PREVIEW of the planner's verdict, and a destination it cannot see
  // is the planner's to answer. A refusal invented here would be a fence.
  expect(movingOf(derived, { record: "install", to: ["nowhere"] }).refusals)
    .toEqual([null])
})

test("nothing aimed at is a row and no verdicts — the panel before its search answers", () => {
  expect(movingOf(derived, { record: "install", to: [] }).refusals).toEqual([])
})
