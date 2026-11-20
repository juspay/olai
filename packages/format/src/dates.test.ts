import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import {
  dailyNoteDays,
  dailyNotePathFor,
  dailyNotesOn,
  datedDays,
  datedOn,
  type DayEntry,
  isDay,
  noteDateOf,
} from "./dates.ts"
import { derive, type Derived } from "./derive.ts"
import { dayOf, monthOf } from "./occasion.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
const SET = derive(TEST_CLAIMS,
  nodesOfFiles({
    "work.olai": [
      `{"id":"deck","ord":"a0","title":"the deck"}`,
      `{"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","date":"2026-08-05"}`,
      `{"id":"rails","parent":"deck","ord":"a1","title":"order the railings","date":"2026-08-05T14:30","doing":true}`,
      `{"id":"sweep","parent":"deck","ord":"a2","title":"sweep up"}`,
      `{"id":"july","ord":"a1","title":"the last day of July","date":"2026-07-31"}`,
      `{"id":"september","ord":"a2","title":"the first day of September","date":"2026-09-01"}`,
    ].join("\n"),
    "life.olai": [
      `{"id":"trip","ord":"a0","title":"the coast trip"}`,
      `{"id":"ferry","parent":"trip","ord":"a0","title":"book the ferry","date":"2026-08-05T09:00"}`,
      `{"id":"pack","parent":"trip","ord":"a1","title":"pack the bags","date":"2026-08-31"}`,
    ].join("\n"),
  }),
)

const MARKED = derive(TEST_CLAIMS,
  nodesOfFiles({
    "ship.olai": [
      `{"id":"header","ord":"a0","title":"the header bar","done":"2026-08-11T15:40:03-04:00"}`,
      `{"id":"survey","ord":"a1","title":"the boundary survey","done":"2026-08-12T09:15:00-04:00","date":"2026-08-11"}`,
      `{"id":"quote","ord":"a2","title":"get a quote","done":"2026-08-11T17:02:00-04:00","date":"2026-08-11T08:00"}`,
      `{"id":"demo","ord":"a3","title":"take out the counters","done":true}`,
      `{"id":"cabinets","ord":"a4","title":"install the cabinets","doing":"2026-08-11T11:00:00-04:00"}`,
      `{"id":"paint","ord":"a5","title":"paint the hall","todo":"2026-08-13"}`,
      `{"id":"tiles","ord":"a6","title":"pick the tiles","todo":"2026-08-11","date":"2026-08-14"}`,
      `{"id":"skylight","ord":"a7","title":"cut a skylight","cancelled":"2026-08-11T16:20:00-04:00"}`,
      `{"id":"deck","ord":"a8","title":"rebuild the deck","cancelled":"2026-08-12T10:00:00-04:00","date":"2026-08-11"}`,
      `{"id":"gutters","ord":"a9","title":"clear the gutters","cancelled":true}`,
    ].join("\n"),
  }),
)

const rowsOn = (derived: Derived, day: string): ReadonlyArray<DayEntry> =>
  datedOn(derived, day).flatMap((group) => group.nodes)

const idsOf = (derived: Derived, day: string): ReadonlyArray<string> =>
  rowsOn(derived, day).map((dated) => dated.shows.node.id)

const ids = (day: string): ReadonlyArray<string> => idsOf(SET, day)

const occasionOf = (day: string, id: string): string | undefined =>
  rowsOn(MARKED, day).find((dated) => dated.shows.node.id === id)?.occasion

test("a datetime is on its own calendar day", () => {
  expect(dayOf("2026-08-10")).toBe("2026-08-10")
  expect(dayOf("2026-08-10T14:30")).toBe("2026-08-10")
  expect(dayOf("2026-08-10T14:30:00Z")).toBe("2026-08-10")
  expect(dayOf("2026-08-10 14:30")).toBe("2026-08-10")
  expect(monthOf("2026-08-10T14:30")).toBe("2026-08")
})

test("a month's days are the days of that month with something on them", () => {
  expect([...datedDays(SET, "2026-08")].sort()).toEqual(["2026-08-05", "2026-08-31"])
})

test("a day at the edge of a month belongs to that month alone", () => {
  expect([...datedDays(SET, "2026-07")]).toEqual(["2026-07-31"])
  expect([...datedDays(SET, "2026-09")]).toEqual(["2026-09-01"])
  expect(datedDays(SET, "2026-08").includes("2026-07-31")).toBe(false)
  expect(datedDays(SET, "2026-08").includes("2026-09-01")).toBe(false)
})

test("a month with nothing in it has no days", () => {
  expect(datedDays(SET, "2026-06").length).toBe(0)
  expect(datedDays(derive(TEST_CLAIMS, []), "2026-08").length).toBe(0)
})

test("a day is lit once, whatever is on it", () => {
  expect(datedDays(SET, "2026-08").includes("2026-08-05")).toBe(true)
})

test("a day collects every outline that has something on it", () => {
  expect(datedOn(SET, "2026-08-05").map((group) => group.file)).toEqual([
    "life.olai",
    "work.olai",
  ])
})

test("a group's nodes are in time order, a bare date first", () => {
  expect(ids("2026-08-05")).toEqual(["ferry", "posts", "rails"])
})

test("a node dated a day carries its status and its canonical ancestry", () => {
  const [dated] = rowsOn(SET, "2026-08-05")
  expect(dated!.shows.node.id).toBe("ferry")
  expect(dated!.status).toBeUndefined()
  expect(dated!.trail.map((crumb) => crumb.node.id)).toEqual(["trip"])
})

test("a dated node carries the mark it stores", () => {
  const rails = rowsOn(SET, "2026-08-05").find((dated) =>
    dated.shows.node.id === "rails"
  )
  expect(rails?.status).toBe("doing")
})

test("a day with nothing on it is an empty answer, not a missing one", () => {
  expect(datedOn(SET, "2026-08-06")).toEqual([])
  expect(ids("2026-08-31")).toEqual(["pack"])
})

test("an undated node is on no day", () => {
  expect(ids("2026-08-05")).not.toContain("sweep")
})

test("a node is on the day its mark was dated", () => {
  expect(idsOf(MARKED, "2026-08-11")).toContain("header")
  expect(datedDays(MARKED, "2026-08").includes("2026-08-11")).toBe(true)
})

test("a node carrying two dates is on both days, once each", () => {
  expect(idsOf(MARKED, "2026-08-11")).toContain("survey")
  expect(idsOf(MARKED, "2026-08-12")).toEqual(["survey", "deck"])
  expect(occasionOf("2026-08-11", "survey")).toBe("date")
  expect(occasionOf("2026-08-12", "survey")).toBe("done")
})

test("two dates on one day are one row", () => {
  expect(idsOf(MARKED, "2026-08-11").filter((id) => id === "quote")).toEqual(["quote"])
  expect(occasionOf("2026-08-11", "quote")).toBe("date")
})

test("a mark with no date is on no day", () => {
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("demo")
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("gutters")
})

test("a node is on the day it was CALLED OFF, and the row says so", () => {
  expect(idsOf(MARKED, "2026-08-11")).toContain("skylight")
  expect(occasionOf("2026-08-11", "skylight")).toBe("cancelled")
  expect(datedDays(MARKED, "2026-08").includes("2026-08-11")).toBe(true)

  expect(idsOf(MARKED, "2026-08-11")).toContain("deck")
  expect(occasionOf("2026-08-11", "deck")).toBe("date")
  expect(occasionOf("2026-08-12", "deck")).toBe("cancelled")
})

test("a dated `doing` or `todo` puts a node nowhere", () => {
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("cabinets")
  expect(datedOn(MARKED, "2026-08-13")).toEqual([])
  expect(datedDays(MARKED, "2026-08").includes("2026-08-13")).toBe(false)
})

test("a node's `date` is read while its `todo` date is not", () => {
  expect(idsOf(MARKED, "2026-08-14")).toEqual(["tiles"])
  expect(occasionOf("2026-08-14", "tiles")).toBe("date")
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("tiles")
})

test("only the read fields light a month's days", () => {
  expect([...datedDays(MARKED, "2026-08")].sort()).toEqual([
    "2026-08-11",
    "2026-08-12",
    "2026-08-14",
  ])
})

test("a day's rows are in time order across the fields", () => {
  expect(idsOf(MARKED, "2026-08-11"))
    .toEqual(["survey", "deck", "quote", "header", "skylight"])
})

test("a row shows the date that put it on the day", () => {
  const [row] = rowsOn(MARKED, "2026-08-12")
  expect(row!.date).toBe("2026-08-12T09:15:00-04:00")
  expect(row!.status).toBe("done")

  const called = rowsOn(MARKED, "2026-08-12")[1]
  expect(called!.date).toBe("2026-08-12T10:00:00-04:00")
  expect(called!.status).toBe("cancelled")
})

test("two records claiming one id are two rows, not one", () => {
  const duplicated = derive(TEST_CLAIMS,
    nodesOfFiles({
      "a.olai": `{"id":"dup","ord":"a0","title":"one","done":"2026-08-11T09:00:00-04:00"}`,
      "b.olai": `{"id":"dup","ord":"a0","title":"the other","done":"2026-08-11T10:00:00-04:00"}`,
    }),
  )
  expect(idsOf(duplicated, "2026-08-11")).toEqual(["dup", "dup"])
})

test("an archived node is on no day, and lights no day in the calendar", () => {
  const archived = derive(TEST_CLAIMS,
    nodesOfFiles({
      "_olai/Trash.olai":
        `{"id":"deck","ord":"a0","title":"the deck","done":"2026-08-11T09:00:00-04:00"}`,
    }),
  )
  expect(idsOf(archived, "2026-08-11")).toEqual([])
  expect(datedOn(archived, "2026-08-11")).toEqual([])
  expect(datedDays(archived, "2026-08").includes("2026-08-11")).toBe(false)
})

test("the live outline keeps the day the archive was taken off", () => {
  const beside = derive(TEST_CLAIMS,
    nodesOfFiles({
      "_olai/Trash.olai":
        `{"id":"deck","ord":"a0","title":"the deck","done":"2026-08-11T09:00:00-04:00"}`,
      "work.olai": `{"id":"rails","ord":"a0","title":"paint the rails","date":"2026-08-11"}`,
    }),
  )
  expect(idsOf(beside, "2026-08-11")).toEqual(["rails"])
  expect(datedOn(beside, "2026-08-11").map((group) => group.file)).toEqual([
    "work.olai",
  ])
  expect(datedDays(beside, "2026-08").includes("2026-08-11")).toBe(true)
})

test("a leftover Archive.olai is on no day, and lights no day in the calendar", () => {
  const leftover = derive(TEST_CLAIMS,
    nodesOfFiles({
      "Archive.olai":
        `{"id":"old","ord":"a0","title":"the old deck","done":"2026-08-11T09:00:00-04:00"}`,
      "notes/Archive.olai":
        `{"id":"older","ord":"a0","title":"the older deck","date":"2026-08-11"}`,
      "work.olai": `{"id":"rails","ord":"a0","title":"paint the rails","date":"2026-08-11"}`,
    }),
  )
  expect(idsOf(leftover, "2026-08-11")).toEqual(["rails"])
  expect(datedOn(leftover, "2026-08-11").map((group) => group.file)).toEqual([
    "work.olai",
  ])
  expect(datedDays(leftover, "2026-08").includes("2026-08-11")).toBe(true)
})

test("a mirror of a dated node does not put it on the day twice", () => {
  const mirrored = derive(TEST_CLAIMS,
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig","date":"2026-08-05"}`,
      "life.olai": `{"id":"posts-here","ord":"a0","mirror":"posts"}`,
    }),
  )
  expect(datedOn(mirrored, "2026-08-05").map((group) => group.file)).toEqual([
    "work.olai",
  ])
  expect(datedDays(mirrored, "2026-08").length).toBe(1)
})

const VAULT: ReadonlyArray<string> = [
  "notes/palette.md",
  "Daily/2026/08/2026-08-12.md",
  "2026-08-10-recap.md",
  "2026-08-11.md",
  "journal/2026-08-12.md",
  "finishes.md",
]

test("a document named for a date is that day's note, wherever it lives", () => {
  expect(noteDateOf(TEST_CLAIMS, "Daily/2026/08/2026-08-12.md")).toBe("2026-08-12")
  expect(noteDateOf(TEST_CLAIMS, "2026-08-11.md")).toBe("2026-08-11")
  expect(noteDateOf(TEST_CLAIMS, "a/deep/tree/1999-01-01.md")).toBe("1999-01-01")
})

test("a document merely NAMING a date is not that day's note", () => {
  for (
    const file of [
      "2026-08-10-recap.md",
      "recap-2026-08-10.md",
      "2026-08.md",
      "2026-08-1.md",
      "2026-8-12.md",
      "20260812.md",
      "2026-08-10.txt",
      "2026-08-10.olai",
      "2026-08-10/notes.md",
      "notes.md",
      "",
    ]
  ) {
    expect(noteDateOf(TEST_CLAIMS, file)).toBeNull()
  }
})

test("a day's note is the document named for it, and no other", () => {
  expect(dailyNotesOn(TEST_CLAIMS, VAULT, "2026-08-11")).toEqual(["2026-08-11.md"])
  expect(dailyNotesOn(TEST_CLAIMS, VAULT, "2026-08-10")).toEqual([])
  expect(dailyNotesOn(TEST_CLAIMS, [], "2026-08-11")).toEqual([])
})

test("two documents claiming one date are both the day's, in path order", () => {
  expect(dailyNotesOn(TEST_CLAIMS, VAULT, "2026-08-12")).toEqual([
    "Daily/2026/08/2026-08-12.md",
    "journal/2026-08-12.md",
  ])
})

test("a day's note and a note inside the day's own directory read as the walk does", () => {
  expect(dailyNotesOn(TEST_CLAIMS, ["2026-08-17.md", "2026-08-17/2026-08-17.md"], "2026-08-17")).toEqual([
    "2026-08-17/2026-08-17.md",
    "2026-08-17.md",
  ])
})

test("a month's noted days are the days of that month a note is written for", () => {
  expect([...dailyNoteDays(TEST_CLAIMS, VAULT, "2026-08")].sort()).toEqual([
    "2026-08-11",
    "2026-08-12",
  ])
  expect(dailyNoteDays(TEST_CLAIMS, VAULT, "2026-07").size).toBe(0)
  expect(dailyNoteDays(TEST_CLAIMS, [], "2026-08").size).toBe(0)
})

test("a day with two notes is one noted day", () => {
  expect([...dailyNoteDays(TEST_CLAIMS, ["a/2026-08-12.md", "b/2026-08-12.md"], "2026-08")])
    .toEqual(["2026-08-12"])
})

test("a note and a dated node are two separate answers about one day", () => {
  const notes = ["2026-08-05.md", "2026-08-06.md"]
  expect(dailyNoteDays(TEST_CLAIMS, notes, "2026-08").has("2026-08-05")).toBe(true)
  expect(datedDays(SET, "2026-08").includes("2026-08-05")).toBe(true)
  expect(dailyNoteDays(TEST_CLAIMS, notes, "2026-08").has("2026-08-06")).toBe(true)
  expect(datedDays(SET, "2026-08").includes("2026-08-06")).toBe(false)
  expect(dailyNoteDays(TEST_CLAIMS, notes, "2026-08").has("2026-08-31")).toBe(false)
  expect(datedDays(SET, "2026-08").includes("2026-08-31")).toBe(true)
})

test("a minted note follows the newest note's directory, date segments re-spelled", () => {
  const vault = [
    "Daily/2025/12/2025-12-31.md",
    "Daily/2026/08/2026-08-12.md",
    "readme.md",
  ]
  expect(dailyNotePathFor(TEST_CLAIMS, vault, "2026-09-01")).toBe("Daily/2026/09/2026-09-01.md")
  expect(dailyNotePathFor(TEST_CLAIMS, vault, "2027-01-05")).toBe("Daily/2027/01/2027-01-05.md")
})

test("a YYYY-MM directory is one segment, re-spelled whole", () => {
  expect(dailyNotePathFor(TEST_CLAIMS, ["journal/2026-08/2026-08-12.md"], "2026-09-01"))
    .toBe("journal/2026-09/2026-09-01.md")
})

test("a segment that merely contains a date part travels verbatim", () => {
  expect(dailyNotePathFor(TEST_CLAIMS, ["archive-2026/2026-02-05.md"], "2027-03-01"))
    .toBe("archive-2026/2027-03-01.md")
})

test("a flat vault stays flat, and an empty one starts at the root", () => {
  expect(dailyNotePathFor(TEST_CLAIMS, ["2026-08-12.md", "notes/other.md"], "2026-08-15"))
    .toBe("2026-08-15.md")
  expect(dailyNotePathFor(TEST_CLAIMS, [], "2026-08-15")).toBe("2026-08-15.md")
  expect(dailyNotePathFor(TEST_CLAIMS, ["notes/other.md"], "2026-08-15")).toBe("2026-08-15.md")
})

test("the newest note is the example, ties broken by path", () => {
  expect(
    dailyNotePathFor(TEST_CLAIMS,
      ["old/2026-01-01.md", "Daily/2026/08/2026-08-12.md"],
      "2026-08-13",
    ),
  ).toBe("Daily/2026/08/2026-08-13.md")
  expect(
    dailyNotePathFor(TEST_CLAIMS, ["b/2026-08-12.md", "a/2026-08-12.md"], "2026-08-13"),
  ).toBe("a/2026-08-13.md")
})

test("what may name a day is the note-detection rule, exported", () => {
  expect(isDay("2026-08-13")).toBe(true)
  expect(isDay("2026-8-13")).toBe(false)
  expect(isDay("2026-08-13T10:00")).toBe(false)
  expect(isDay("someday")).toBe(false)
})
