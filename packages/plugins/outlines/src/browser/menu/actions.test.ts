import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, rowsOf, type Row, zoom } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { NO_PINS } from "@olai/format"
import { expect, spyOn, test } from "bun:test"

import type { Relation } from "../edges/relation.ts"
import { flatten } from "../edit/order.ts"
import * as writes from "../writes.ts"
import { isSub, type MenuAction, type MenuEntry } from "./action.ts"
import { nodeMenuActions, type Panels, subjectMenuActions } from "./actions.ts"
import { subjectOfSituated } from "./verbs.ts"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
const routes = routingIn()


const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
  `{"id":"echo","ord":"a2","mirror":"install"}`,
].join("\n")

const derived = derive(TEST_CLAIMS, recordsOf(setOf({ "house.olai": HOUSE })))

const row = (id: string): Row => {
  const found = flatten(rowsOf(derived, "house.olai"), new Set())
    .find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

const actionsFor = (
  id: string,
  opens: (relation?: Relation) => unknown,
) =>
  nodeMenuActions({
    routes,
    row: row(id),
    pins: NO_PINS,
    foldable: [],
    go: () => {},
    record: () => {},
    panels: {
      pickDate: opens as () => void,
      pickRepeat: opens as () => void,
      pickEdge: opens as (relation: Relation) => void,
      addProp: opens as () => void,
      pickMove: opens as () => void,
    },
  })

const verbsOf = (entries: ReadonlyArray<MenuEntry>): ReadonlyArray<MenuAction> =>
  entries.flatMap((one) => (isSub(one) ? verbsOf(one.entries) : [one]))

const entry = (id: string, label: string) => {
  const found = verbsOf(actionsFor(id, () => true)).find((one) => one.label === label)
  if (found === undefined) throw new Error(`\`${id}\` offers no ${JSON.stringify(label)}`)
  return found
}

const shape = (entries: ReadonlyArray<MenuEntry>): ReadonlyArray<unknown> =>
  entries.flatMap((one) => [
    ...(one.divider === true ? ["—"] : []),
    isSub(one) ? { [one.label]: shape(one.entries) } : one.label,
  ])

test("the menu is short, in groups a rule apart, with Move to Trash last and alone", () => {
  expect(shape(actionsFor("kitchen", () => true))).toEqual([
    "Zoom in",
    { Mark: ["To do", "Done", "Cancelled", "Clear"] },
    "—",
    "Set date…",
    "Pin to sidebar",
    "—",
    "Move to…",
    "Duplicate",
    "—",
    { More: ["Copy link", "Copy as text", "Expand all", "Collapse all", "Add property…", "Link to…", "Wait for…"] },
    "—",
    "Move to Trash",
  ])
})

test("a leaf row has no folds to offer, and a mirror retires itself from More", () => {
  expect(shape(actionsFor("echo", () => true))).toEqual([
    "Zoom in",
    { Mark: ["To do", "Doing", "Done", "Cancelled"] },
    "—",
    "Set date…",
    "Pin to sidebar",
    "—",
    "Move to…",
    "—",
    { More: ["Copy link", "Copy as text", "Add property…", "Link to…", "Wait for…", "Remove from here"] },
  ])
})

test("opening the picker says NOTHING, whatever the opener answers with", () => {
  expect(entry("install", "Set date…").run()).toBeUndefined()
})

test("an edge verb says nothing either, and names the relation it opens", () => {
  expect(entry("install", "Link to…").run()).toBeUndefined()
  let asked: Relation | undefined
  const actions = verbsOf(actionsFor("install", (relation) => {
    asked = relation as Relation
    return relation
  }))
  actions.find((one) => one.label === "Wait for…")?.run()
  expect(asked).toBe("after")
})

test("...and it still opens the picker", () => {
  let opened = 0
  const actions = verbsOf(actionsFor("install", () => {
    opened += 1
    return true
  }))
  actions.find((one) => one.label === "Set date…")?.run()
  expect(opened).toBe(1)
})

test("a verb that WRITES still answers with a promise the panel can read", async () => {
  const applying = spyOn(writes, "applying").mockImplementation(async () => ({
    tone: "aside",
    text: "kitchen remodel is done",
  }))
  try {
    const answer = entry("install", "To do").run()
    expect(answer).toBeInstanceOf(Promise)
    expect(await answer).toEqual({
      tone: "aside",
      text: "kitchen remodel is done",
    })
  } finally {
    applying.mockRestore()
  }
})

const withClipboard = async <T>(
  clipboard: { readonly writeText: (text: string) => Promise<void> },
  run: () => Promise<T>,
): Promise<T> => {
  const nav = globalThis.navigator
  const had = Object.getOwnPropertyDescriptor(nav, "clipboard")
  Object.defineProperty(nav, "clipboard", {
    configurable: true,
    enumerable: true,
    value: clipboard,
  })
  try {
    return await run()
  } finally {
    if (had === undefined) Reflect.deleteProperty(nav, "clipboard")
    else Object.defineProperty(nav, "clipboard", had)
  }
}

test("a copy that LANDED answers with a remark, so the ordinary case is not silent", async () => {
  const written: string[] = []
  const answers = await withClipboard(
    { writeText: (text) => (written.push(text), Promise.resolve()) },
    async () => ({
      link: await entry("install", "Copy link").run(),
      text: await entry("install", "Copy as text").run(),
    }),
  )
  expect(answers.link).toEqual({ tone: "aside", text: "Link copied" })
  expect(answers.text).toEqual({ tone: "aside", text: "Text copied" })
  expect(written).toHaveLength(2)
})

test("a copy the browser REFUSED answers with no remark at all — it throws", async () => {
  const thrown = await withClipboard(
    { writeText: () => Promise.reject(new Error("denied")) },
    async () => {
      try {
        await entry("install", "Copy link").run()
        return null
      } catch (cause) {
        return cause as Error
      }
    },
  )
  expect(thrown?.message).toBe("denied")
})

const situatedLabels = (id: string, panels: Panels): ReadonlyArray<string> => {
  const zoomed = zoom(derived, id)
  if (zoomed.kind !== "node") throw new Error(`no node \`${id}\` in the fixture`)
  return verbsOf(subjectMenuActions({
    routes,
    subject: subjectOfSituated(zoomed),
    under: zoomed.under,
    pins: NO_PINS,
    go: () => {},
    record: () => {},
    panels,
  })).map((one) => one.label)
}

test("a verb whose panel the surface does not draw is not offered at all", () => {
  const none = situatedLabels("install", {})
  for (const opens of ["Set date…", "Link to…", "Wait for…", "Add property…", "Move to…"]) {
    expect(none).not.toContain(opens)
  }
  expect(none).toContain("Done")
  expect(none).toContain("Duplicate")
  expect(none).toContain("Move to Trash")

  const some = situatedLabels("install", { pickDate: () => {}, pickEdge: () => {} })
  expect(some).toContain("Set date…")
  expect(some).toContain("Link to…")
  expect(some).toContain("Wait for…")
  expect(some).not.toContain("Move to…")
  expect(some).not.toContain("Add property…")
})

test("a situated node's menu keeps its groups in their order, a rule above each but the first", () => {
  const actions = subjectMenuActions({
    routes,
    subject: subjectOfSituated((() => {
      const zoomed = zoom(derived, "install")
      if (zoomed.kind !== "node") throw new Error("no `install` in the fixture")
      return zoomed
    })()),
    under: 0,
    pins: NO_PINS,
    go: () => {},
    record: () => {},
    panels: {},
  })
  expect(actions.map((one) => one.id)).toEqual(["zoom", "mark", "pin", "duplicate", "more", "trash"])
  expect(actions.filter((one) => one.divider === true).map((one) => one.id)).toEqual(["pin", "duplicate", "more", "trash"])
  const more = actions.find((one) => one.id === "more")
  expect(more !== undefined && isSub(more) ? more.entries[0]?.id : undefined).toBe("copy-link")
})

test("a group draws in the catalog's order: the pin ends its group, and the clears end More", () => {
  const set = derive(TEST_CLAIMS, recordsOf(setOf({ "due.olai": [
    `{"id":"due","ord":"a0","title":"due","date":"2026-08-10","repeat":"every day"}`,
    `{"id":"here","ord":"a1","mirror":"due"}`,
  ].join("\n") })))
  const here = flatten(rowsOf(set, "due.olai"), new Set()).find((one) => one.at.node.id === "here")!
  const open = () => {}
  const menu = nodeMenuActions({
    routes, row: here, pins: NO_PINS, foldable: [], go: open, record: open,
    panels: { pickDate: open, pickRepeat: open, pickEdge: open, addProp: open, pickMove: open },
  })
  expect(menu.map((one) => one.id)).toEqual(["zoom", "mark", "set-date", "set-repeat", "pin", "move-to", "more"])
  const more = menu.find((one) => one.id === "more")
  expect(more !== undefined && "entries" in more ? more.entries.map((one) => one.id) : []).toEqual([
    "copy-link", "copy-text", "prop-add", "edge-see", "edge-after", "remove-placement", "clear-date", "clear-repeat",
  ])
})
