/**
 * Which verbs a row offers, and what each of them sends.
 *
 * The whole of the menu's contextual behaviour is here, because the whole of
 * it is a pure function of a row: the mark section, the date that is only
 * there when there is one, the placement verb, the archive and its question.
 * Over rows the format itself walked, so "what does a mirror offer" is
 * answered against a real expansion.
 */

import { derive, rowsOf, type Row } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { datePick } from "../date/pick.ts"
import { repeatPick } from "../date/repeat.ts"
import { flatten } from "../edit/order.ts"
import { subjectOfRow, writeVerbs } from "./verbs.ts"

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

const derived = derive(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN }).nodes)
const rows = rowsOf(derived, "house.olai")

/** One row of the fixture, by id — through the client's own walk
 *  (`edit/order.ts`) with nothing folded, rather than a second one here. */
const row = (id: string): Row => {
  const found = flatten(rows, new Set()).find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

const labels = (id: string): ReadonlyArray<string> =>
  writeVerbs(subjectOfRow(row(id)), derived).map((verb) => verb.label)

const verb = (id: string, label: string) => {
  const found = writeVerbs(subjectOfRow(row(id)), derived).find((one) => one.label === label)
  if (found === undefined) {
    throw new Error(`\`${id}\` offers no ${JSON.stringify(label)}: ${labels(id).join(", ")}`)
  }
  return found
}

/** The edit one entry sends — and a failure naming the entry when it sends
 *  none, which is the one that opens the picker instead. */
const edit = (id: string, label: string) => {
  const does = verb(id, label).does
  if (does.kind !== "edit") {
    throw new Error(`\`${id}\`'s ${JSON.stringify(label)} opens something; it sends no edit`)
  }
  return does.edit
}

// ── the mark section ───────────────────────────────────────────────────

test("a node with no mark is offered the three, and nothing to clear", () => {
  expect(labels("install")).toEqual([
    "Mark todo",
    "Mark doing",
    "Complete",
    "Set date…",
    "Add property…",
    "Link to a node…",
    "Wait for a node…",
    "Move to…",
    "Duplicate",
    "Move to Trash",
  ])
})

test("the mark a node already carries is not offered back to it", () => {
  // `kitchen` is doing. Putting `doing` on it again is the one request the ops
  // layer refuses for asking about nothing, and the row's own checkbox is
  // three pixels away from the menu that would have said so.
  expect(labels("kitchen")).toEqual([
    "Mark todo",
    "Complete",
    "Clear mark",
    "Set date…",
    "Add property…",
    "Link to a node…",
    "Wait for a node…",
    "Move to…",
    "Duplicate",
    "Move to Trash",
  ])
})

test("a done node is still offered the two that walk it back, because ops answers that", () => {
  // Not a fence here: choosing one is refused in the ops layer's own words
  // ("nothing should decide on your behalf that finished work is not
  // finished"), which is the sentence a person needs and the two calls an
  // agent makes.
  expect(labels("demo")).toContain("Mark todo")
  expect(labels("demo")).toContain("Mark doing")
})

test("a mark names the node the row SHOWS, so a mirror marks its target", () => {
  expect(edit("kitchen-herbs", "Mark doing")).toEqual({
    verb: "mark",
    id: "herbs",
    mark: "doing",
  })
})

test("clearing a mark is the same verb saying none", () => {
  expect(edit("kitchen", "Clear mark")).toEqual({
    verb: "mark",
    id: "kitchen",
    mark: null,
  })
})

// ── the date ───────────────────────────────────────────────────────────

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
  // The two doors, compared. They are one constructor today (`Clear date` is
  // `datePick(id, "")`), and this is what says so from the outside: a split
  // could not be seen any other way, because the ops layer reads `""` and
  // `null` as the same effect on disk — so a door that started sending the
  // other one would go on working while the faces diverged. Updating the
  // literal in the test above can no longer hide that.
  expect(edit("order", "Clear date")).toEqual(datePick("order", ""))
})

test("every row that draws a node can reach the picker, under the name that fits it", () => {
  // The one entry offered whatever the row carries, because both halves of
  // `set_date` are now a person's: an undated node is being SCHEDULED, a dated
  // one CHANGED. A dated row's other door is the pill on the line itself.
  expect(labels("install")).toContain("Set date…")
  expect(labels("order")).toContain("Change date…")
  expect(labels("order")).not.toContain("Set date…")
})

test("the picker entry sends nothing on its own", () => {
  // The write is a gesture later, when a day has been chosen — and it is then
  // the same `date` edit `Clear date` sends (`../date/pick.ts`). An entry that
  // carried one here would have to invent a day.
  expect(verb("install", "Set date…").does).toEqual({ kind: "pick-date" })
  expect(verb("order", "Change date…").does).toEqual({ kind: "pick-date" })
})

test("the two date entries are next to each other, in that order", () => {
  // Change, then clear: the reader is looking at a date, and the two things
  // they can do to it read as one pair rather than being separated by the
  // verb that takes the branch away.
  expect(labels("order").filter((label) => label.toLowerCase().includes("date")))
    .toEqual(["Change date…", "Clear date"])
})

// ── the repeat rule ────────────────────────────────────────────────────

// The one place this menu FENCES a write rather than offering it and letting
// the ops layer answer — and it is not the menu's policy: the format refuses a
// rule with no date to repeat FROM, so the entry over an undated row is an
// affordance whose only outcome is that refusal, with `Set date…` sitting
// directly above it.
test("only a dated row is offered a repeat rule", () => {
  expect(labels("order")).toContain("Set repeat…")
  expect(labels("install")).not.toContain("Set repeat…")
})

test("the repeat entry sends nothing on its own", () => {
  // The write is a gesture later, when a rule has been chosen — and it is then
  // the same `repeat` edit `Stop repeating` sends (`../date/repeat.ts`).
  expect(verb("order", "Set repeat…").does).toEqual({ kind: "pick-repeat" })
})

test("a repeating row says CHANGE, and gains the entry that stops it", () => {
  const repeating = derive(
    setOf({
      "house.olai": HOUSE.replace(
        `"title":"order the cabinets","date":"2026-08-10"`,
        `"title":"order the cabinets","date":"2026-08-10","repeat":"every week on monday"`,
      ),
      "garden.olai": GARDEN,
    }).nodes,
  )
  const found = flatten(rowsOf(repeating, "house.olai"), new Set())
    .find((one) => one.at.node.id === "order")
  if (found === undefined) throw new Error("no row for `order`")
  const verbs = writeVerbs(subjectOfRow(found), repeating)
  const said = verbs.map((one) => one.label)
  expect(said).toContain("Change repeat…")
  expect(said).not.toContain("Set repeat…")
  // ONE constructor for both doors: the menu's `Stop repeating` and the
  // picker's empty option are the same edit, so they cannot come to disagree
  // about how "no rule" is spelled on the wire.
  const stop = verbs.find((one) => one.label === "Stop repeating")
  expect(stop?.does).toEqual({ kind: "edit", edit: repeatPick("order", "") })
})

// ── the properties ─────────────────────────────────────────────────────

test("every row that draws a node offers to add a property", () => {
  // Offered on a node carrying none, which is the same rule the two edge verbs
  // follow: naming a fact about a node is a thing you do to a node that says
  // nothing yet.
  expect(labels("install")).toContain("Add property…")
  expect(verb("install", "Add property…").does).toEqual({
    kind: "pick-prop",
    editing: null,
  })
})

test("a property it carries is offered for editing, with what it holds", () => {
  // The panel is TOLD what it is editing rather than looking it up again off a
  // row it does not have — so the key and the value in the boxes came from one
  // read of one record.
  expect(verb("order", "Edit pr…").does).toEqual({
    kind: "pick-prop",
    editing: { key: "pr", value: "https://x/1" },
  })
})

test("removing one sends the op's own null, under its key", () => {
  expect(edit("order", "Remove pr")).toEqual({
    verb: "prop",
    id: "order",
    key: "pr",
    value: null,
  })
})

test("the node's own facts have no property entries, because they have verbs", () => {
  // `order` carries a `date`, and the entry for it is `Change date…`. An
  // `Edit date…` beside it would be a second spelling of one write — and the
  // one the ops layer refuses by name.
  expect(labels("order")).not.toContain("Edit date…")
  expect(labels("order")).not.toContain("Remove date")
  expect(labels("order")).not.toContain("Remove id")
  expect(labels("kitchen")).not.toContain("Remove status")
})

test("a property holding a LIST may be removed and not edited", () => {
  // The editor writes text, so a key holding three values would come back as
  // one string with commas in it. Taking it off is exact whatever it held.
  expect(labels("order")).toContain("Remove tags")
  expect(labels("order")).not.toContain("Edit tags…")
})

test("a placement offers the picker for the node it SHOWS", () => {
  // `herbs` is undated, so the mirror's row says what its target says. Which
  // id the write names is not this file's answer at all: the picker is opened
  // on the row, and the row hands it the node it draws (`../Tree.tsx`), which
  // is the same rule the mark verbs follow.
  expect(labels("kitchen-herbs")).toContain("Set date…")
})

// ── the placement ──────────────────────────────────────────────────────

test("a mirror row retires ITS OWN record, never the node it shows", () => {
  expect(edit("kitchen-herbs", "Remove this placement")).toEqual({
    verb: "unmirror",
    id: "kitchen-herbs",
  })
})

test("a placement drawing no node offers only the two verbs about its RECORD", () => {
  // The question is asked of the RECORD, so a row that drew nothing needs no
  // case of its own — and the verbs that are about a node are correctly absent
  // rather than absent by accident. A served set holding this mirror is one
  // the validator refuses, so it is not a row a reader meets today; what the
  // test pins is that the catalog does not depend on the row having drawn.
  //
  // TWO of them are about the record rather than about a node: retiring the
  // placement, and moving it. A line a reader can see is a line they can carry
  // somewhere else, whatever it managed to draw.
  expect(labels("lost")).toEqual(["Move to…", "Remove this placement"])
})

test("a node's own row has no placement verb", () => {
  expect(labels("install")).not.toContain("Remove this placement")
})

// ── the duplicate ──────────────────────────────────────────────────────

test("a duplicate names the row's own record, and asks nothing first", () => {
  expect(edit("install", "Duplicate")).toEqual({ verb: "duplicate", id: "install" })
  expect(verb("install", "Duplicate").confirm).toBeUndefined()
})

test("a placement is not duplicated — retiring it is what a line offers", () => {
  // The same split the put-away makes. Copying through a mirror would write a
  // subtree into the file its target lives in, out of sight of the row that
  // was clicked.
  expect(labels("kitchen-herbs")).not.toContain("Duplicate")
  expect(labels("lost")).not.toContain("Duplicate")
})

test("it sits above the put-away, so the additive verb is not next to the reach", () => {
  const shown = labels("install")
  expect(shown.indexOf("Duplicate")).toBeLessThan(shown.indexOf("Move to Trash"))
})

// ── the trash ──────────────────────────────────────────────────────────

test("the put-away is a node's verb, not a placement's", () => {
  // On a mirror the reader is looking at a line, and the verb for a line is
  // retiring it; archiving from there would put away a subtree living
  // somewhere else, out of sight. The LABEL speaks Trash — the human-facing
  // name — while the edit it sends is still the `archive` op's own word.
  expect(labels("kitchen-herbs")).not.toContain("Move to Trash")
  expect(edit("install", "Move to Trash")).toEqual({ verb: "archive", id: "install" })
})

test("the confirm names the row, how much goes with it, and the way back", () => {
  expect(verb("kitchen", "Move to Trash").confirm).toBe(
    "Move “kitchen remodel” and the 4 rows under it to the Trash? They keep " +
      "their ids, and the Trash in the sidebar is where to put them back.",
  )
})

test("a childless row is asked about on its own", () => {
  expect(verb("install", "Move to Trash").confirm).toBe(
    "Move “install them” to the Trash? It keeps its id, and the Trash in " +
      "the sidebar is where to put it back.",
  )
})

test("nothing but the put-away asks a question first", () => {
  expect(
    writeVerbs(subjectOfRow(row("kitchen")), derived).filter((verb) => verb.confirm !== undefined)
      .map((verb) => verb.label),
  ).toEqual(["Move to Trash"])
})

test("with no indexes yet there is no archive, rather than one nobody counted", () => {
  // A moment no row is drawn in — the first frame has not arrived — but the
  // one verb whose question is about the SET may not be offered with a number
  // read off something else.
  expect(writeVerbs(subjectOfRow(row("kitchen")), undefined).map((verb) => verb.label))
    .toEqual([
      "Mark todo",
      "Complete",
      "Clear mark",
      "Set date…",
      "Add property…",
      "Link to a node…",
      "Wait for a node…",
      "Move to…",
      "Duplicate",
    ])
})
