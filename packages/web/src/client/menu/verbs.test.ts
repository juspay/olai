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

import { writeVerbs } from "./verbs.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","date":"2026-08-10"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  `{"id":"lost","ord":"a1","mirror":"nothing-declares-this"}`,
].join("\n")

const GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed","todo":true}`,
].join("\n")

const rows = rowsOf(
  derive(setOf({ "house.jsonl": HOUSE, "garden.jsonl": GARDEN }).nodes),
  "house.jsonl",
)

const all = (of: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  of.flatMap((one) => [one, ...all(one.children)])

const row = (id: string): Row => {
  const found = all(rows).find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

const labels = (id: string): ReadonlyArray<string> =>
  writeVerbs(row(id)).map((verb) => verb.label)

const edit = (id: string, label: string) => {
  const verb = writeVerbs(row(id)).find((one) => one.label === label)
  if (verb === undefined) {
    throw new Error(`\`${id}\` offers no ${JSON.stringify(label)}: ${labels(id).join(", ")}`)
  }
  return verb
}

// ── the mark section ───────────────────────────────────────────────────

test("a node with no mark is offered the three, and nothing to clear", () => {
  expect(labels("install")).toEqual([
    "Mark todo",
    "Mark doing",
    "Complete",
    "Archive",
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
    "Archive",
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
  expect(edit("kitchen-herbs", "Mark doing").edit).toEqual({
    verb: "mark",
    id: "herbs",
    mark: "doing",
  })
})

test("clearing a mark is the same verb saying none", () => {
  expect(edit("kitchen", "Clear mark").edit).toEqual({
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
  expect(edit("order", "Clear date").edit).toEqual({
    verb: "date",
    id: "order",
    date: null,
  })
})

// ── the placement ──────────────────────────────────────────────────────

test("a mirror row retires ITS OWN record, never the node it shows", () => {
  expect(edit("kitchen-herbs", "Remove this placement").edit).toEqual({
    verb: "unmirror",
    id: "kitchen-herbs",
  })
})

test("a placement whose target is gone can still be retired", () => {
  // The one row nothing else in this app can do anything about — and the row
  // most likely to be somebody's mistake.
  expect(labels("lost")).toEqual(["Remove this placement"])
})

test("a node's own row has no placement verb", () => {
  expect(labels("install")).not.toContain("Remove this placement")
})

// ── the archive ────────────────────────────────────────────────────────

test("archive is a node's verb, not a placement's", () => {
  // On a mirror the reader is looking at a line, and the verb for a line is
  // retiring it; archiving from there would put away a subtree living
  // somewhere else, out of sight.
  expect(labels("kitchen-herbs")).not.toContain("Archive")
  expect(edit("install", "Archive").edit).toEqual({ verb: "archive", id: "install" })
})

test("the confirm names the row and how much goes with it", () => {
  expect(edit("kitchen", "Archive").confirm).toBe(
    "Archive “kitchen remodel” and the 4 rows under it? They go to Archive.jsonl " +
      "with their ids kept — there is no unarchive yet, so bringing them back means " +
      "editing that file.",
  )
})

test("a childless row is asked about on its own", () => {
  expect(edit("install", "Archive").confirm).toBe(
    "Archive “install them”? It goes to Archive.jsonl with its id kept — there is " +
      "no unarchive yet, so bringing it back means editing that file.",
  )
})

test("nothing but the archive asks a question first", () => {
  expect(
    writeVerbs(row("kitchen")).filter((verb) => verb.confirm !== undefined).map((verb) =>
      verb.label
    ),
  ).toEqual(["Archive"])
})
