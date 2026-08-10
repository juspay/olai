import { expect, test } from "bun:test"

import { datedDays, datedOn, dayOf, monthOf } from "./dates.ts"
import { derive } from "./derive.ts"
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

const ids = (day: string): ReadonlyArray<string> =>
  datedOn(SET, day).flatMap((group) => group.nodes.map((dated) => dated.shows.node.id))

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
  expect(dated!.status).toBe("open")
  expect(dated!.trail.map((crumb) => crumb.node.id)).toEqual(["trip"])
})

// The status is DERIVED, the same answer the tree draws: `rails` says `doing`
// about itself and its parent says nothing at all.
test("a stored status is the derived one", () => {
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
