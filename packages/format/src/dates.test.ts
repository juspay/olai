import { expect, test } from "bun:test"

import { datedDays, datedOn, dayOf, monthOf } from "./dates.ts"
import { derive, type Derived } from "./derive.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"

/** Two outlines with dates spread over three months, which is what makes the
 *  month boundaries above and below testable rather than assumed. */
const SET = derive(
  nodesOfFiles({
    "work.jsonl": [
      `{"id":"deck","ord":"a0","title":"the deck"}`,
      `{"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","date":"2026-08-05"}`,
      // Later in the day than `posts`, and written to the file first — so a
      // pass that ordered by line rather than by time would put it above.
      `{"id":"rails","parent":"deck","ord":"a1","title":"order the railings","date":"2026-08-05T14:30","doing":true}`,
      `{"id":"sweep","parent":"deck","ord":"a2","title":"sweep up"}`,
      `{"id":"july","ord":"a1","title":"the last day of July","date":"2026-07-31"}`,
      `{"id":"september","ord":"a2","title":"the first day of September","date":"2026-09-01"}`,
    ].join("\n"),
    "life.jsonl": [
      `{"id":"trip","ord":"a0","title":"the coast trip"}`,
      `{"id":"ferry","parent":"trip","ord":"a0","title":"book the ferry","date":"2026-08-05T09:00"}`,
      `{"id":"pack","parent":"trip","ord":"a1","title":"pack the bags","date":"2026-08-31"}`,
    ].join("\n"),
  }),
)

/**
 * The same reading, of a set whose dates are on its MARKS.
 *
 * A second fixture rather than more lines in the first, so what the `date`
 * field does keeps being asserted against a set that has not moved — the marks
 * are what is new here, and a suite where both changed at once could not say
 * which rule the answer came from.
 */
const MARKED = derive(
  nodesOfFiles({
    "ship.jsonl": [
      // Finished at an instant, scheduled for nothing: the roadmap's own shape
      // after the done-datetime migration, and the case that vanished from the
      // calendar when only `date` counted.
      `{"id":"header","ord":"a0","title":"the header bar","done":"2026-08-11T15:40:03-04:00"}`,
      // Scheduled one day, finished another. Two dates, two days, one row each.
      `{"id":"survey","ord":"a1","title":"the boundary survey","done":"2026-08-12T09:15:00-04:00","date":"2026-08-11"}`,
      // Scheduled and finished on the SAME day, which is one thing that
      // happened and one row.
      `{"id":"quote","ord":"a2","title":"get a quote","done":"2026-08-11T17:02:00-04:00","date":"2026-08-11T08:00"}`,
      // A mark that says only that the state was reached. Legal, and on no day.
      `{"id":"demo","ord":"a3","title":"take out the counters","done":true}`,
      // The other two marks carry dates too, and the checkbox is what says
      // which kind it is.
      `{"id":"cabinets","ord":"a4","title":"install the cabinets","doing":"2026-08-11T11:00:00-04:00"}`,
      `{"id":"paint","ord":"a5","title":"paint the hall","todo":"2026-08-13"}`,
    ].join("\n"),
  }),
)

const idsOf = (derived: Derived, day: string): ReadonlyArray<string> =>
  datedOn(derived, day).flatMap((group) =>
    group.nodes.map((dated) => dated.shows.node.id)
  )

const ids = (day: string): ReadonlyArray<string> => idsOf(SET, day)

/** What one node's row on a day says it is there for. */
const occasionOf = (day: string, id: string): string | undefined =>
  datedOn(MARKED, day)
    .flatMap((group) => group.nodes)
    .find((dated) => dated.shows.node.id === id)
    ?.occasion

// ── what a value's day and month are ───────────────────────────────────

// The whole of the date arithmetic in this package: a prefix. A datetime
// counts for its day, because a person asking what is on the 10th means the
// meeting at half past two.
test("a datetime is on its own calendar day", () => {
  expect(dayOf("2026-08-10")).toBe("2026-08-10")
  expect(dayOf("2026-08-10T14:30")).toBe("2026-08-10")
  expect(dayOf("2026-08-10T14:30:00Z")).toBe("2026-08-10")
  expect(dayOf("2026-08-10 14:30")).toBe("2026-08-10")
  expect(monthOf("2026-08-10T14:30")).toBe("2026-08")
})

// ── the dots ───────────────────────────────────────────────────────────

test("a month's days are the days of that month with something on them", () => {
  expect([...datedDays(SET, "2026-08")].sort()).toEqual(["2026-08-05", "2026-08-31"])
})

// The two ends of a month are exactly where an off-by-one lives, so both are
// named: July's last day and September's first are in their OWN months and in
// neither of the others.
test("a day at the edge of a month belongs to that month alone", () => {
  expect([...datedDays(SET, "2026-07")]).toEqual(["2026-07-31"])
  expect([...datedDays(SET, "2026-09")]).toEqual(["2026-09-01"])
  expect(datedDays(SET, "2026-08").has("2026-07-31")).toBe(false)
  expect(datedDays(SET, "2026-08").has("2026-09-01")).toBe(false)
})

test("a month with nothing in it has no days", () => {
  expect(datedDays(SET, "2026-06").size).toBe(0)
  expect(datedDays(derive([]), "2026-08").size).toBe(0)
})

// A dot is drawn for the DAY, however many nodes sit on it, and a node whose
// date carries a time still lights its own day.
test("a day is lit once, whatever is on it", () => {
  expect(datedDays(SET, "2026-08").has("2026-08-05")).toBe(true)
})

// ── one day ────────────────────────────────────────────────────────────

test("a day collects every outline that has something on it", () => {
  expect(datedOn(SET, "2026-08-05").map((group) => group.file)).toEqual([
    "life.jsonl",
    "work.jsonl",
  ])
})

// A bare date is the day itself, so it sorts as the earliest thing in it;
// everything else is in time order. `rails` is written above nothing and dated
// below `posts`, which is the case a line-ordered pass gets wrong.
test("a group's nodes are in time order, a bare date first", () => {
  expect(ids("2026-08-05")).toEqual(["ferry", "posts", "rails"])
})

test("a node dated a day carries its status and its canonical ancestry", () => {
  const [dated] = datedOn(SET, "2026-08-05")[0]!.nodes
  expect(dated!.shows.node.id).toBe("ferry")
  // Dated and unmarked: a day is a thing on the calendar, not a to-do list, so
  // `ferry` has no status at all until somebody marks it.
  expect(dated!.status).toBeUndefined()
  expect(dated!.trail.map((crumb) => crumb.node.id)).toEqual(["trip"])
})

// The status is the node's own mark, the same answer the tree draws: `rails`
// says `doing` about itself and its parent says nothing at all.
test("a dated node carries the mark it stores", () => {
  const rails = datedOn(SET, "2026-08-05")
    .flatMap((group) => group.nodes)
    .find((dated) => dated.shows.node.id === "rails")
  expect(rails?.status).toBe("doing")
})

test("a day with nothing on it is an empty answer, not a missing one", () => {
  expect(datedOn(SET, "2026-08-06")).toEqual([])
  expect(ids("2026-08-31")).toEqual(["pack"])
})

// An undated node is not a day's business however close it sits to one.
test("an undated node is on no day", () => {
  expect(ids("2026-08-05")).not.toContain("sweep")
})

// ── the dates on the marks ─────────────────────────────────────────────

// The requirement, in one line: a node finished at an instant is on that day
// exactly as a scheduled one is, and it lights that day in the calendar.
test("a node is on the day its mark was dated", () => {
  expect(idsOf(MARKED, "2026-08-11")).toContain("header")
  expect(datedDays(MARKED, "2026-08").has("2026-08-11")).toBe(true)
})

test("a node carrying two dates is on both days, once each", () => {
  expect(idsOf(MARKED, "2026-08-11")).toContain("survey")
  expect(idsOf(MARKED, "2026-08-12")).toEqual(["survey"])
  expect(occasionOf("2026-08-11", "survey")).toBe("date")
  expect(occasionOf("2026-08-12", "survey")).toBe("done")
})

// Scheduled for a day and finished on it is ONE thing that happened. The row
// says `date`, because a mark's kind is already in the checkbox beside it and
// the day it was scheduled for is written nowhere else.
test("two dates on one day are one row", () => {
  expect(idsOf(MARKED, "2026-08-11").filter((id) => id === "quote")).toEqual(["quote"])
  expect(occasionOf("2026-08-11", "quote")).toBe("date")
})

// `true` says the state was reached and declines to say when — the shape
// everything written before the marks carried instants still has.
test("a mark with no date is on no day", () => {
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("demo")
  expect([...datedDays(MARKED, "2026-08")].sort()).toEqual([
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
  ])
})

// Any dated mark places a node, not only `done`: the format lets all three
// carry a date, and the checkbox is what says which kind it is.
test("a dated `doing` or `todo` puts a node on its day too", () => {
  expect(occasionOf("2026-08-11", "cabinets")).toBe("doing")
  expect(occasionOf("2026-08-13", "paint")).toBe("todo")
})

// One order over every date on the day, whichever field it came off: a bare
// date is the day itself and comes first, and the two instants follow in the
// order they happened.
test("a day's rows are in time order across the fields", () => {
  expect(idsOf(MARKED, "2026-08-11")).toEqual([
    "survey",
    "quote",
    "cabinets",
    "header",
  ])
})

// The row carries the date it is THERE for, not whatever else the node stores
// — a completion instant on the day it was completed.
test("a row shows the date that put it on the day", () => {
  const [row] = datedOn(MARKED, "2026-08-12")[0]!.nodes
  expect(row!.date).toBe("2026-08-12T09:15:00-04:00")
  expect(row!.status).toBe("done")
})

// A mirror is a second PLACEMENT of a node, and the format gives it no field
// to carry a date. So a dated node that is mirrored elsewhere appears on its
// day once, at the record that actually declares it.
test("a mirror of a dated node does not put it on the day twice", () => {
  const mirrored = derive(
    nodesOfFiles({
      "work.jsonl": `{"id":"posts","ord":"a0","title":"dig","date":"2026-08-05"}`,
      "life.jsonl": `{"id":"posts-here","ord":"a0","mirror":"posts"}`,
    }),
  )
  expect(datedOn(mirrored, "2026-08-05").map((group) => group.file)).toEqual([
    "work.jsonl",
  ])
  expect(datedDays(mirrored, "2026-08").size).toBe(1)
})
