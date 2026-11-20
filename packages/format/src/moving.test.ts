import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { derive } from "./derive.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import { type Destination, type Moved, movingOf, whyNot } from "./moving.ts"

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

const derived = derive(TEST_CLAIMS,
  nodesOfFiles({
    "house.olai": HOUSE,
    "garden.olai": GARDEN,
    "_olai/Trash.olai": AWAY,
  }),
)

const at = (id: string): Destination => {
  const located = derived.byId.get(id)
  if (located === undefined) throw new Error(`no \`${id}\` in the fixture`)
  return { id, title: "title" in located.node ? located.node.title : id, file: located.file }
}

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
  const why = whyNot(INSTALL, at("handles"), derived) ?? ""
  expect(why).toContain("inside the row you are moving")
  expect(why).not.toContain("→")
})

test("a destination a descendant PLACEMENT draws is refused, naming the chain", () => {
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
  expect(whyNot(moving("now"), at("kitchen"), derived)).toBeNull()
  expect(whyNot(moving("now"), at("demo"), derived)).toBeNull()
})

test("a placement may not be put inside what it shows — it would expand forever", () => {
  expect(whyNot(moving("kitchen-install"), at("install"), derived))
    .toContain("through a placement")
  expect(whyNot(moving("kitchen-install"), at("handles"), derived))
    .toContain("through a placement")
})

test("...and may go anywhere else in its file, including beside what it shows", () => {
  expect(whyNot(moving("kitchen-install"), at("demo"), derived)).toBeNull()
})

test("a destination in another outline is not refused at all any more", () => {
  expect(whyNot(INSTALL, at("herbs"), derived)).toBeNull()
})

test("an archived destination still says it is put away", () => {
  const why = whyNot(INSTALL, at("tiles"), derived) ?? ""
  expect(why).toContain("put away")
  expect(why).toContain("Put back")
})

test("the row's CURRENT parent is refused, and says what it would have done", () => {
  const why = whyNot(INSTALL, at("kitchen"), derived) ?? ""
  expect(why).toContain("already this row's parent")
  expect(why).toContain("reorder")
})

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
  expect(said.refusals[2]).toBeNull()
})

test("a MIRROR is moved as the placement it is, and called by what it shows", () => {
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
  expect(movingOf(derived, { record: "install", to: ["nowhere"] }).refusals)
    .toEqual([null])
})

test("nothing aimed at is a row and no verdicts — the panel before its search answers", () => {
  expect(movingOf(derived, { record: "install", to: [] }).refusals).toEqual([])
})
