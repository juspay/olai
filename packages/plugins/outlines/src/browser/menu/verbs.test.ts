import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, rowsOf, type Row } from "@olai/format"
import { NO_PINS, type Shelf } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { datePick } from "../date/pick.ts"
import { repeatPick } from "../date/repeat.ts"
import { flatten } from "../edit/order.ts"
import { subjectOfRow, writeVerbs } from "./verbs.ts"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
const routes = routingIn()


const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","date":"2026-08-10","custom":{"pr":"https://x/1","tags":["a","b"]}}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  `{"id":"lost","ord":"a1","mirror":"nothing-declares-this"}`,
].join("\n")

const GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed","todo":true}`,
].join("\n")

const derived = derive(TEST_CLAIMS,
  recordsOf(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })),
)
const rows = rowsOf(derived, "house.olai")

const row = (id: string): Row => {
  const found = flatten(rows, new Set()).find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

const labels = (id: string): ReadonlyArray<string> =>
  writeVerbs(routes, subjectOfRow(row(id)), row(id).under, NO_PINS).map((verb) => verb.label)

const verb = (id: string, label: string) => {
  const found = writeVerbs(routes, subjectOfRow(row(id)), row(id).under, NO_PINS)
    .find((one) => one.label === label)
  if (found === undefined) {
    throw new Error(`\`${id}\` offers no ${JSON.stringify(label)}: ${labels(id).join(", ")}`)
  }
  return found
}

const edit = (id: string, label: string) => {
  const does = verb(id, label).does
  if (does.kind !== "edit") {
    throw new Error(`\`${id}\`'s ${JSON.stringify(label)} opens something; it sends no edit`)
  }
  return does.edit
}

test("a node not on the shelf is offered a pin, at its own page's address", () => {
  expect(edit("install", "Pin to sidebar")).toEqual({ verb: "pin", at: "/zoom/#install" })
})

test("a mirror pins the node it SHOWS, never the placement standing there", () => {
  expect(edit("kitchen-herbs", "Pin to sidebar")).toEqual({ verb: "pin", at: "/zoom/#herbs" })
})

test("a node the shelf already holds is offered the way OFF it instead", () => {
  const shelf: Shelf = [{ id: "p-install", title: "/zoom/#install" }]
  const offered = writeVerbs(routes, subjectOfRow(row("install")), row("install").under, shelf)
  expect(offered.map((one) => one.label)).toContain("Unpin from sidebar")
  expect(offered.map((one) => one.label)).not.toContain("Pin to sidebar")
  expect(offered.find((one) => one.id === "unpin")?.does)
    .toEqual({ kind: "edit", edit: { verb: "trash", id: "p-install" } })
})

const grouped = (id: string): ReadonlyArray<readonly [string, string]> =>
  writeVerbs(routes, subjectOfRow(row(id)), row(id).under, NO_PINS).map((one) => [one.label, one.group])

test("every verb says which group of the menu it sits in", () => {
  expect(grouped("install")).toEqual([
    ["To do", "mark"],
    ["Doing", "mark"],
    ["Done", "mark"],
    ["Cancelled", "mark"],
    ["Set date…", "plan"],
    ["Pin to sidebar", "plan"],
    ["Add property…", "more"],
    ["Link to…", "more"],
    ["Wait for…", "more"],
    ["Move to…", "place"],
    ["Duplicate", "place"],
    ["Move to Trash", "away"],
  ])
})

test("taking a fact back off goes with the rarely reached, and the mark's clear with the marks", () => {
  expect(grouped("order").filter(([label]) => label === "Clear date")).toEqual([["Clear date", "more"]])
  expect(grouped("kitchen").filter(([label]) => label === "Clear")).toEqual([["Clear", "mark"]])
  expect(grouped("kitchen-herbs").filter(([label]) => label === "Remove from here")).toEqual([["Remove from here", "more"]])
})

test("a node with no mark is offered the four, and nothing to clear", () => {
  expect(labels("install")).toEqual([
        "To do",
    "Doing",
    "Done",
    "Cancelled",
    "Set date…",
    "Pin to sidebar",
    "Add property…",
    "Link to…",
    "Wait for…",
    "Move to…",
    "Duplicate",
    "Move to Trash",
  ])
})

test("the mark a node already carries is not offered back to it", () => {
  expect(labels("kitchen")).toEqual([
        "To do",
    "Done",
    "Cancelled",
    "Clear",
    "Set date…",
    "Pin to sidebar",
    "Add property…",
    "Link to…",
    "Wait for…",
    "Move to…",
    "Duplicate",
    "Move to Trash",
  ])
})

test("a done node is still offered the two that walk it back, because ops answers that", () => {
  expect(labels("demo")).toContain("To do")
  expect(labels("demo")).toContain("Doing")
})

test("a mark names the node the row SHOWS, so a mirror marks its target", () => {
  expect(edit("kitchen-herbs", "Doing")).toEqual({
    verb: "mark",
    id: "herbs",
    mark: "doing",
  })
})

test("clearing a mark is the same verb saying none", () => {
  expect(edit("kitchen", "Clear")).toEqual({
    verb: "mark",
    id: "kitchen",
    mark: null,
  })
})

test("only a dated row offers to clear one", () => {
  expect(labels("order")).toContain("Clear date")
  expect(labels("install")).not.toContain("Clear date")
})

test("clearing a date sends the op's own null", () => {
  expect(edit("order", "Clear date")).toEqual({
    verb: "date",
    id: "order",
    date: null,
  })
})

test("the menu's clear and the picker's emptied box are ONE edit", () => {
  expect(edit("order", "Clear date")).toEqual(datePick("order", ""))
})

test("every row that draws a node can reach the picker, under the name that fits it", () => {
  expect(labels("install")).toContain("Set date…")
  expect(labels("order")).toContain("Change date…")
  expect(labels("order")).not.toContain("Set date…")
})

test("the picker entry sends nothing on its own", () => {
  expect(verb("install", "Set date…").does).toEqual({ kind: "pick-date" })
  expect(verb("order", "Change date…").does).toEqual({ kind: "pick-date" })
})

test("the two date entries come in that order: change, then clear", () => {
  expect(labels("order").filter((label) => label.toLowerCase().includes("date")))
    .toEqual(["Change date…", "Clear date"])
})

test("only a dated row is offered a repeat rule", () => {
  expect(labels("order")).toContain("Set repeat…")
  expect(labels("install")).not.toContain("Set repeat…")
})

test("the repeat entry sends nothing on its own", () => {
  expect(verb("order", "Set repeat…").does).toEqual({ kind: "pick-repeat" })
})

test("a repeating row says CHANGE, and gains the entry that stops it", () => {
  const repeating = derive(TEST_CLAIMS,
    recordsOf(setOf({
      "house.olai": HOUSE.replace(
        `"title":"order the cabinets","date":"2026-08-10"`,
        `"title":"order the cabinets","date":"2026-08-10","repeat":"every week on monday"`,
      ),
      "garden.olai": GARDEN,
    })),
  )
  const found = flatten(rowsOf(repeating, "house.olai"), new Set())
    .find((one) => one.at.node.id === "order")
  if (found === undefined) throw new Error("no row for `order`")
  const verbs = writeVerbs(routes, subjectOfRow(found), found.under, NO_PINS)
  const said = verbs.map((one) => one.label)
  expect(said).toContain("Change repeat…")
  expect(said).not.toContain("Set repeat…")
  const stop = verbs.find((one) => one.label === "Stop repeating")
  expect(stop?.does).toEqual({ kind: "edit", edit: repeatPick("order", "") })
})

test("a node carrying NO property is offered the one entry that adds one", () => {
  expect(labels("install")).toContain("Add property…")
  expect(verb("install", "Add property…").does).toEqual({ kind: "add-prop" })
})

test("a node that HAS one is offered nothing at all about properties", () => {
  expect(labels("order")).not.toContain("Add property…")
  expect(labels("order")).not.toContain("Edit pr…")
  expect(labels("order")).not.toContain("Remove pr")
  expect(labels("order")).not.toContain("Remove tags")
})

test("the node's own facts have no property entries, because they have verbs", () => {
  expect(labels("order")).not.toContain("Edit date…")
  expect(labels("order")).not.toContain("Remove date")
  expect(labels("order")).not.toContain("Remove id")
  expect(labels("kitchen")).not.toContain("Remove status")
})

test("a placement offers the picker for the node it SHOWS", () => {
  expect(labels("kitchen-herbs")).toContain("Set date…")
})

test("a mirror row retires ITS OWN record, never the node it shows", () => {
  expect(edit("kitchen-herbs", "Remove from here")).toEqual({
    verb: "unmirror",
    id: "kitchen-herbs",
  })
})

test("a placement drawing no node offers only the two verbs about its RECORD", () => {
  expect(labels("lost")).toEqual(["Move to…", "Remove from here"])
})

test("a node's own row has no placement verb", () => {
  expect(labels("install")).not.toContain("Remove from here")
})

test("a duplicate names the row's own record, and asks nothing first", () => {
  expect(edit("install", "Duplicate")).toEqual({ verb: "duplicate", id: "install" })
  expect(verb("install", "Duplicate").confirm).toBeUndefined()
})

test("a placement is not duplicated — retiring it is what a line offers", () => {
  expect(labels("kitchen-herbs")).not.toContain("Duplicate")
  expect(labels("lost")).not.toContain("Duplicate")
})

test("it sits above the put-away, so the additive verb is not next to the reach", () => {
  const shown = labels("install")
  expect(shown.indexOf("Duplicate")).toBeLessThan(shown.indexOf("Move to Trash"))
})

test("the put-away is a node's verb, not a placement's", () => {
  expect(labels("kitchen-herbs")).not.toContain("Move to Trash")
  expect(edit("install", "Move to Trash")).toEqual({ verb: "trash", id: "install" })
})

test("the confirm names the row, how much goes with it, and the way back", () => {
  expect(verb("kitchen", "Move to Trash").confirm).toBe(
    "Move “kitchen remodel” and the 4 rows under it to Trash? You can put " +
      "them back from Trash in the sidebar.",
  )
})

test("a childless row is asked about on its own", () => {
  expect(verb("install", "Move to Trash").confirm).toBe(
    "Move “install them” to Trash? You can put it back from Trash in the " +
      "sidebar.",
  )
})

test("nothing but the put-away asks a question first", () => {
  expect(
    writeVerbs(routes, subjectOfRow(row("kitchen")), row("kitchen").under, NO_PINS)
      .filter((verb) => verb.confirm !== undefined)
      .map((verb) => verb.label),
  ).toEqual(["Move to Trash"])
})

test("with no indexes yet there is no archive, rather than one nobody counted", () => {
  expect(writeVerbs(routes, subjectOfRow(row("kitchen")), undefined, NO_PINS).map((verb) => verb.label))
    .toEqual([
            "To do",
      "Done",
      "Cancelled",
      "Clear",
      "Set date…",
      "Pin to sidebar",
      "Add property…",
      "Link to…",
      "Wait for…",
      "Move to…",
      "Duplicate",
    ])
})

test("a binding-only row keeps Add property when its chip is drawer-only", () => {
  const at = derive(TEST_CLAIMS, recordsOf(setOf({ "binding.olai":
    '{"id":"bound","title":"Bound","ord":"a0","custom":{"session":"engine:session"}}',
  })))
  const found = flatten(rowsOf(at, "binding.olai"), new Set())[0]!
  const subject = subjectOfRow(found)
  expect(writeVerbs(routes, subject, found.under, NO_PINS).map(one => one.label)).not.toContain("Add property…")
  expect(writeVerbs(routes, subject, found.under, NO_PINS, {
    kind: () => "binding", at: () => ({ inRows: false }),
  }).map(one => one.label)).toContain("Add property…")
})
