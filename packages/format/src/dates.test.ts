import { expect, test } from "bun:test"

import {
  dailyNoteDays,
  dailyNotePathFor,
  dailyNotesOn,
  datedDays,
  datedOn,
  dayOf,
  type DayEntry,
  isDay,
  monthOf,
  noteDateOf,
} from "./dates.ts"
import { derive, type Derived } from "./derive.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"

/** Two outlines with dates spread over three months, which is what makes the
 *  month boundaries above and below testable rather than assumed. */
const SET = derive(
  nodesOfFiles({
    "work.olai": [
      `{"id":"deck","ord":"a0","title":"the deck"}`,
      `{"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","date":"2026-08-05"}`,
      // Later in the day than `posts`, and written to the file first — so a
      // pass that ordered by line rather than by time would put it above.
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
    "ship.olai": [
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
      // The other two marks may carry dates — the format allows it, and these
      // are what the roadmap was full of — and no view here reads them.
      `{"id":"cabinets","ord":"a4","title":"install the cabinets","doing":"2026-08-11T11:00:00-04:00"}`,
      `{"id":"paint","ord":"a5","title":"paint the hall","todo":"2026-08-13"}`,
      // A dated `todo` that is ALSO scheduled: the `date` places it, the
      // `todo` adds nothing, and it is one row rather than two.
      `{"id":"tiles","ord":"a6","title":"pick the tiles","todo":"2026-08-11","date":"2026-08-14"}`,
    ].join("\n"),
  }),
)

/** Every row of a day, across its groups — the order and the membership both,
 *  which is what every assertion below is about. */
const rowsOn = (derived: Derived, day: string): ReadonlyArray<DayEntry> =>
  datedOn(derived, day).flatMap((group) => group.nodes)

const idsOf = (derived: Derived, day: string): ReadonlyArray<string> =>
  rowsOn(derived, day).map((dated) => dated.shows.node.id)

const ids = (day: string): ReadonlyArray<string> => idsOf(SET, day)

/** What one node's row on a day says it is there for. */
const occasionOf = (day: string, id: string): string | undefined =>
  rowsOn(MARKED, day).find((dated) => dated.shows.node.id === id)?.occasion

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
    "life.olai",
    "work.olai",
  ])
})

// A bare date is the day itself, so it sorts as the earliest thing in it;
// everything else is in time order. `rails` is written above nothing and dated
// below `posts`, which is the case a line-ordered pass gets wrong.
test("a group's nodes are in time order, a bare date first", () => {
  expect(ids("2026-08-05")).toEqual(["ferry", "posts", "rails"])
})

test("a node dated a day carries its status and its canonical ancestry", () => {
  const [dated] = rowsOn(SET, "2026-08-05")
  expect(dated!.shows.node.id).toBe("ferry")
  // Dated and unmarked: a day is a thing on the calendar, not a to-do list, so
  // `ferry` has no status at all until somebody marks it.
  expect(dated!.status).toBeUndefined()
  expect(dated!.trail.map((crumb) => crumb.node.id)).toEqual(["trip"])
})

// The status is the node's own mark, the same answer the tree draws: `rails`
// says `doing` about itself and its parent says nothing at all.
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
// everything written before `done` carried instants still has.
test("a mark with no date is on no day", () => {
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("demo")
})

/**
 * The rule the human resolved on 2026-08-11 after seeing a day page under it:
 * `doing` and `todo` dates are NOT read, however legal they are on disk.
 *
 * Asserted negatively and from both ends, because the failure this pins is a
 * row that should not be there: `cabinets` was picked up on the 11th and
 * `paint` filed for the 13th, so under the old rule the 11th gained a row and
 * the 13th gained a whole DAY — a dot on a calendar for a day nothing is
 * actually on.
 */
test("a dated `doing` or `todo` puts a node nowhere", () => {
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("cabinets")
  expect(datedOn(MARKED, "2026-08-13")).toEqual([])
  expect(datedDays(MARKED, "2026-08").has("2026-08-13")).toBe(false)
})

// A node can carry both, and only the `date` half is read: one row, on the day
// it is scheduled for, and nothing on the day it was filed.
test("a node's `date` is read while its `todo` date is not", () => {
  expect(idsOf(MARKED, "2026-08-14")).toEqual(["tiles"])
  expect(occasionOf("2026-08-14", "tiles")).toBe("date")
  expect(idsOf(MARKED, "2026-08-11")).not.toContain("tiles")
})

// The month's dots are that same rule, read the other way: three days have
// something on them, and the two that only a `doing` or a `todo` named do not.
test("only the read fields light a month's days", () => {
  expect([...datedDays(MARKED, "2026-08")].sort()).toEqual([
    "2026-08-11",
    "2026-08-12",
    "2026-08-14",
  ])
})

// One order over both fields: a bare date is the day itself and comes first,
// and the instants follow in the order they happened.
test("a day's rows are in time order across the fields", () => {
  expect(idsOf(MARKED, "2026-08-11")).toEqual(["survey", "quote", "header"])
})

// The row carries the date it is THERE for, not whatever else the node stores
// — a completion instant on the day it was completed.
test("a row shows the date that put it on the day", () => {
  const [row] = rowsOn(MARKED, "2026-08-12")
  expect(row!.date).toBe("2026-08-12T09:15:00-04:00")
  expect(row!.status).toBe("done")
})

// One row per RECORD, which is not the same promise as one row per id: these
// walks run over sets the validator has condemned as well as over legal ones,
// and two files each claiming `dup` are two nodes a reader is still being
// shown. Deduping on the id would quietly draw one of them.
test("two records claiming one id are two rows, not one", () => {
  const duplicated = derive(
    nodesOfFiles({
      "a.olai": `{"id":"dup","ord":"a0","title":"one","done":"2026-08-11T09:00:00-04:00"}`,
      "b.olai": `{"id":"dup","ord":"a0","title":"the other","done":"2026-08-11T10:00:00-04:00"}`,
    }),
  )
  expect(idsOf(duplicated, "2026-08-11")).toEqual(["dup", "dup"])
})

// Work that was put away leaves the journal with it (ruled 2026-08-17, human,
// reversing 2026-08-11): what is archived is drawn on the TRASH PAGE and
// nowhere else. The day, the calendar's dot and the agenda read this one walk,
// so the rule reaches all three at once — and `is:archived` is what still
// reaches the node itself, at every door (./filter.ts).
test("an archived node is on no day, and lights no day in the calendar", () => {
  const archived = derive(
    nodesOfFiles({
      "Archive.olai":
        `{"id":"deck","ord":"a0","title":"the deck","done":"2026-08-11T09:00:00-04:00"}`,
    }),
  )
  expect(idsOf(archived, "2026-08-11")).toEqual([])
  expect(datedOn(archived, "2026-08-11")).toEqual([])
  expect(datedDays(archived, "2026-08").has("2026-08-11")).toBe(false)
})

// The other half of the same rule: what a day loses is the archived rows and
// nothing beside them. A live outline goes on answering for the day it shares
// with an archive, heading and all.
test("the live outline keeps the day the archive was taken off", () => {
  const beside = derive(
    nodesOfFiles({
      "Archive.olai":
        `{"id":"deck","ord":"a0","title":"the deck","done":"2026-08-11T09:00:00-04:00"}`,
      "work.olai": `{"id":"rails","ord":"a0","title":"paint the rails","date":"2026-08-11"}`,
    }),
  )
  expect(idsOf(beside, "2026-08-11")).toEqual(["rails"])
  expect(datedOn(beside, "2026-08-11").map((group) => group.file)).toEqual([
    "work.olai",
  ])
  expect(datedDays(beside, "2026-08").has("2026-08-11")).toBe(true)
})

// A mirror is a second PLACEMENT of a node, and the format gives it no field
// to carry a date. So a dated node that is mirrored elsewhere appears on its
// day once, at the record that actually declares it.
test("a mirror of a dated node does not put it on the day twice", () => {
  const mirrored = derive(
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig","date":"2026-08-05"}`,
      "life.olai": `{"id":"posts-here","ord":"a0","mirror":"posts"}`,
    }),
  )
  expect(datedOn(mirrored, "2026-08-05").map((group) => group.file)).toEqual([
    "work.olai",
  ])
  expect(datedDays(mirrored, "2026-08").size).toBe(1)
})

// ── the day's own note ─────────────────────────────────────────────────

/** A vault's documents, as the paths a browser holds: a daily note filed the
 *  way the human's is, one in the root, a document ABOUT a day, and two
 *  ordinary files. Deliberately not in path order — the order that comes back
 *  is a promise, and a fixture already sorted could not say so. */
const VAULT: ReadonlyArray<string> = [
  "notes/palette.md",
  "Daily/2026/08/2026-08-12.md",
  "2026-08-10-recap.md",
  "2026-08-11.md",
  "journal/2026-08-12.md",
  "finishes.md",
]

// The whole of the detection rule: the basename, minus `.md`, is exactly an
// ISO date. Wherever the file sits, and whatever is inside it.
test("a document named for a date is that day's note, wherever it lives", () => {
  expect(noteDateOf("Daily/2026/08/2026-08-12.md")).toBe("2026-08-12")
  expect(noteDateOf("2026-08-11.md")).toBe("2026-08-11")
  expect(noteDateOf("a/deep/tree/1999-01-01.md")).toBe("1999-01-01")
})

// The other half, and the reason the rule is worth having: a document about a
// day is not the day. `2026-08-10-recap.md` is the case the design named, and
// it must not match on a prefix.
test("a document merely NAMING a date is not that day's note", () => {
  for (
    const file of [
      "2026-08-10-recap.md",
      "recap-2026-08-10.md",
      "2026-08.md",
      "2026-08-1.md",
      // The two the design spelled out beside `-recap`: an ISO date is
      // zero-padded and hyphenated, so neither a date a person typed short nor
      // one with the hyphens taken out is the name this convention reads.
      "2026-8-12.md",
      "20260812.md",
      "2026-08-10.txt",
      "2026-08-10.olai",
      // The date is the FOLDER here; the file is `notes.md`.
      "2026-08-10/notes.md",
      "notes.md",
      "",
    ]
  ) {
    expect(noteDateOf(file)).toBeNull()
  }
})

test("a day's note is the document named for it, and no other", () => {
  expect(dailyNotesOn(VAULT, "2026-08-11")).toEqual(["2026-08-11.md"])
  expect(dailyNotesOn(VAULT, "2026-08-10")).toEqual([])
  expect(dailyNotesOn([], "2026-08-11")).toEqual([])
})

// Two files may both claim a date — a vault mid-migration has exactly this —
// and both are listed rather than one being picked by a rule nobody asked for.
// Path order, which is the only order they have.
test("two documents claiming one date are both the day's, in path order", () => {
  expect(dailyNotesOn(VAULT, "2026-08-12")).toEqual([
    "Daily/2026/08/2026-08-12.md",
    "journal/2026-08-12.md",
  ])
})

// PATH ORDER IS `byPath`, and this is the pair that says so: a day's own
// directory beside a note named for the same day is exactly the shape a vault
// mid-migration writes, and it is the one pair a code-point sort orders the
// other way (`.` is 0x2E, `/` is 0x2F). The sidebar lists these two nested-file
// first, so a day page that listed them flat-file first would be the same two
// documents in two orders on one screen.
test("a day's note and a note inside the day's own directory read as the walk does", () => {
  expect(dailyNotesOn(["2026-08-17.md", "2026-08-17/2026-08-17.md"], "2026-08-17")).toEqual([
    "2026-08-17/2026-08-17.md",
    "2026-08-17.md",
  ])
})

// The calendar's second mark, asked of the same convention: the days of ONE
// month that have a note, so a caller drawing August is not handed September.
test("a month's noted days are the days of that month a note is written for", () => {
  expect([...dailyNoteDays(VAULT, "2026-08")].sort()).toEqual([
    "2026-08-11",
    "2026-08-12",
  ])
  expect(dailyNoteDays(VAULT, "2026-07").size).toBe(0)
  expect(dailyNoteDays([], "2026-08").size).toBe(0)
})

// A day is lit once however many documents claim it — the mark is drawn for
// the DAY, exactly as the node dot is.
test("a day with two notes is one noted day", () => {
  expect([...dailyNoteDays(["a/2026-08-12.md", "b/2026-08-12.md"], "2026-08")])
    .toEqual(["2026-08-12"])
})

// The two readings are INDEPENDENT, which is the whole of the amendment: a
// note joins the query's answer rather than replacing it, so a day may have
// nodes, a note, both, or neither — and nothing here consults the other.
test("a note and a dated node are two separate answers about one day", () => {
  const notes = ["2026-08-05.md", "2026-08-06.md"]
  // The 5th has both; the 6th has only a note; the 31st has only nodes.
  expect(dailyNoteDays(notes, "2026-08").has("2026-08-05")).toBe(true)
  expect(datedDays(SET, "2026-08").has("2026-08-05")).toBe(true)
  expect(dailyNoteDays(notes, "2026-08").has("2026-08-06")).toBe(true)
  expect(datedDays(SET, "2026-08").has("2026-08-06")).toBe(false)
  expect(dailyNoteDays(notes, "2026-08").has("2026-08-31")).toBe(false)
  expect(datedDays(SET, "2026-08").has("2026-08-31")).toBe(true)
})

// ── where a minted note goes ───────────────────────────────────────────

// The convention is READ, never configured: the newest existing note's own
// path is the example, and its date-shaped directory segments are re-spelled
// for the new day. Detection's rule (`noteDateOf`), facing the other way.
test("a minted note follows the newest note's directory, date segments re-spelled", () => {
  const vault = [
    "Daily/2025/12/2025-12-31.md",
    "Daily/2026/08/2026-08-12.md",
    "readme.md",
  ]
  expect(dailyNotePathFor(vault, "2026-09-01")).toBe("Daily/2026/09/2026-09-01.md")
  // A different year re-spells the year segment too.
  expect(dailyNotePathFor(vault, "2027-01-05")).toBe("Daily/2027/01/2027-01-05.md")
})

test("a YYYY-MM directory is one segment, re-spelled whole", () => {
  expect(dailyNotePathFor(["journal/2026-08/2026-08-12.md"], "2026-09-01"))
    .toBe("journal/2026-09/2026-09-01.md")
})

// WHOLE segments only: two digits appear inside years, and substring
// replacement is how `2027` would lose its middle to a February.
test("a segment that merely contains a date part travels verbatim", () => {
  expect(dailyNotePathFor(["archive-2026/2026-02-05.md"], "2027-03-01"))
    .toBe("archive-2026/2027-03-01.md")
})

test("a flat vault stays flat, and an empty one starts at the root", () => {
  expect(dailyNotePathFor(["2026-08-12.md", "notes/other.md"], "2026-08-15"))
    .toBe("2026-08-15.md")
  expect(dailyNotePathFor([], "2026-08-15")).toBe("2026-08-15.md")
  expect(dailyNotePathFor(["notes/other.md"], "2026-08-15")).toBe("2026-08-15.md")
})

// A vault mid-migration: the NEWEST note is where the convention currently
// stands, so old notes somewhere else do not pull a new one back there.
test("the newest note is the example, ties broken by path", () => {
  expect(
    dailyNotePathFor(
      ["old/2026-01-01.md", "Daily/2026/08/2026-08-12.md"],
      "2026-08-13",
    ),
  ).toBe("Daily/2026/08/2026-08-13.md")
  expect(
    dailyNotePathFor(["b/2026-08-12.md", "a/2026-08-12.md"], "2026-08-13"),
  ).toBe("a/2026-08-13.md")
})

test("what may name a day is the note-detection rule, exported", () => {
  expect(isDay("2026-08-13")).toBe(true)
  expect(isDay("2026-8-13")).toBe(false)
  expect(isDay("2026-08-13T10:00")).toBe(false)
  expect(isDay("someday")).toBe(false)
})
