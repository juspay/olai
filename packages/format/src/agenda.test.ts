import { expect, test } from "bun:test"

import {
  type AgendaDay,
  agendaOf,
  type Felt,
  feltOn,
  isOverdue,
  keepingOwed,
  nothingDue,
  owedFact,
  owedIn,
  owedOf,
  quietBetween,
  UPCOMING_DAYS,
} from "./agenda.ts"
import { derive, type Derived } from "./derive.ts"
import { matching, parseFilter } from "./filter.ts"
import { nodesOf, nodesOfFiles } from "./fixtures.testlib.ts"
import { type Located, type RegularNode } from "./node.ts"

/** The day every fixture below is read on. Fixed, because a derivation that
 *  read a clock would be a derivation whose tests expire — and because "before,
 *  on, after" is the whole of what these three sections are about. */
const TODAY = "2026-08-12"

/**
 * Two outlines spanning the three answers: work that slipped, work due today,
 * work coming up — plus every shape that must NOT be on an agenda.
 *
 * Two files rather than one so the grouping is testable at all, and dated
 * either side of {@link TODAY} so the sections cannot be satisfied by an
 * accident of file order.
 */
const SET = derive(
  nodesOfFiles({
    "work.olai": [
      `{"id":"deck","ord":"a0","title":"the deck"}`,
      // Slipped: someone said it was work, and said when.
      `{"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-10"}`,
      // Slipped FURTHER back, and written after `posts` — so a section that
      // ordered by line rather than by date would put it second.
      `{"id":"permit","parent":"deck","ord":"a1","title":"pull the permit","doing":true,"date":"2026-08-03"}`,
      // Dated, unmarked: an OCCURRENCE. Its day has passed and it is simply
      // gone — a day passing is not a failure of a bullet.
      `{"id":"delivery","parent":"deck","ord":"a2","title":"the timber arrives","date":"2026-08-04"}`,
      // Finished last week. `done` extinguishes overdue by construction.
      `{"id":"survey","ord":"a1","title":"the boundary survey","done":"2026-08-05T09:15:00-04:00","date":"2026-08-05"}`,
      // Work with no WHEN. Absent from every section: inventing a day for it is
      // what this format refuses to do.
      `{"id":"paint","ord":"a2","title":"paint the rails","todo":true}`,
      // A date on the MARK and nowhere else. A day page reads neither a dated
      // `doing` nor a dated `todo`, and neither does this.
      `{"id":"filed","ord":"a3","title":"replace the gate latch","todo":"2026-07-30"}`,
    ].join("\n"),
    "life.olai": [
      `{"id":"trip","ord":"a0","title":"the coast trip"}`,
      // Today: one due, one an occurrence, one finished this morning.
      `{"id":"ferry","parent":"trip","ord":"a0","title":"book the ferry","todo":true,"date":"2026-08-12T09:00"}`,
      `{"id":"birthday","parent":"trip","ord":"a1","title":"mum's birthday","date":"2026-08-12"}`,
      `{"id":"visas","parent":"trip","ord":"a2","title":"send the visa forms","done":"2026-08-12T08:00:00-04:00","date":"2026-08-12"}`,
      // Ahead.
      `{"id":"pack","parent":"trip","ord":"a3","title":"pack the bags","todo":true,"date":"2026-08-14"}`,
      `{"id":"train","parent":"trip","ord":"a4","title":"the sleeper leaves","date":"2026-08-20T21:40"}`,
      // Scheduled ahead and already finished: nothing owed, so the 22nd is not
      // a day this agenda knows about at all.
      `{"id":"tickets","parent":"trip","ord":"a5","title":"print the tickets","done":true,"date":"2026-08-22"}`,
    ].join("\n"),
  }),
)

/** The ids a run of day groups lists, in the order it lists them — the
 *  membership and the order are one promise. */
const listed = (
  groups: ReadonlyArray<{ readonly nodes: ReadonlyArray<{ readonly shows: Located }> }>,
): ReadonlyArray<string> =>
  groups.flatMap((group) => group.nodes.map((entry) => entry.shows.node.id))

/** The same, over a run of DAYS — what the two halves of the line hold, read
 *  end to end, which is the order the page draws them in. */
const across = (days: ReadonlyArray<AgendaDay>): ReadonlyArray<string> =>
  days.flatMap((day) => listed(day.groups))

/** One record, parsed the way every fixture in this package is — the predicate
 *  takes a node rather than a set, so this is all it needs. */
const node = (source: string): RegularNode => nodesOf(source)[0]!.node as RegularNode

// ── the predicate ──────────────────────────────────────────────────────

test("a dated `todo` before today is overdue, and a dated `doing` is too", () => {
  // The ruling this feature turns on (human, 2026-08-12): started-but-
  // unfinished is the most honest answer to "should this have happened by now".
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true,"date":"2026-08-10"}`), TODAY))
    .toBe(true)
  expect(
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","doing":true,"date":"2026-08-10"}`), TODAY),
  ).toBe(true)
})

test("a dated bullet is never overdue, however long ago its day was", () => {
  // The crown rule, read once more: an unmarked node is not an unfinished one,
  // so a birthday in 1994 is not work anybody is late on.
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","date":"1994-03-02"}`), TODAY))
    .toBe(false)
})

test("`done` extinguishes it — a finished task is late at nothing", () => {
  expect(
    isOverdue(
      node(`{"id":"a","ord":"a0","title":"a","done":"2026-08-11T09:00:00-04:00","date":"2026-08-01"}`),
      TODAY,
    ),
  ).toBe(false)
})

test("today is not late, and tomorrow certainly is not", () => {
  const due = (date: string): boolean =>
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true,"date":"${date}"}`), TODAY)
  expect(due("2026-08-11")).toBe(true)
  expect(due(TODAY)).toBe(false)
  expect(due("2026-08-13")).toBe(false)
})

test("a datetime counts for its day, at either end of it", () => {
  // The day is the first ten characters and the comparison is plain string
  // order, so a task due at ten to midnight yesterday is late and one due at
  // one minute past midnight tonight is not. Nothing here parses a date.
  const due = (date: string): boolean =>
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true,"date":"${date}"}`), TODAY)
  expect(due("2026-08-11T23:50")).toBe(true)
  expect(due(`${TODAY}T00:01`)).toBe(false)
  // An offset is part of the day it names: a stamp is written where the person
  // making it stands, and the day is theirs.
  expect(due("2026-08-11T22:00:00-04:00")).toBe(true)
})

test("an instant for TODAY still names a day, on the caller's side too", () => {
  // The predicate is total in both its arguments: `today` goes through the same
  // ten-character reading the node's date does, so a caller holding an instant
  // gets the same answer as one holding a day. Without it the comparison says
  // yes to work due today — `"2026-08-12" < "2026-08-12T09:00"` is true, a
  // prefix being less than what extends it — which is the one wrong answer it
  // can give, and the one a reader would notice first.
  const due = (date: string, now: string): boolean =>
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true,"date":"${date}"}`), now)
  expect(due(TODAY, `${TODAY}T09:00`)).toBe(false)
  expect(due(`${TODAY}T08:00`, `${TODAY}T09:00`)).toBe(false)
  expect(due("2026-08-11", `${TODAY}T00:00:00-04:00`)).toBe(true)
})

test("a task with no date is not late — it has no WHEN to be late against", () => {
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true}`), TODAY)).toBe(false)
  // Nor is a date on the mark itself one: filing a task on Tuesday says nothing
  // about when it is due, and no view reads it as a day.
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":"2026-07-30"}`), TODAY))
    .toBe(false)
})

// ── the page ───────────────────────────────────────────────────────────

test("what slipped arrives as DAYS, oldest first, each grouped by outline", () => {
  const agenda = agendaOf(SET, TODAY)
  // A day is where a node goes on the line, so late work brings the day it was
  // owed on with it — one day per date, ascending, and the outline grouping
  // kept INSIDE each of them (the page flattens it; the reading does not).
  expect(agenda.overdue.map((day) => day.date)).toEqual(["2026-08-03", "2026-08-10"])
  expect(agenda.overdue.map((day) => day.groups.map((group) => group.file)))
    .toEqual([["work.olai"], ["work.olai"]])
  expect(across(agenda.overdue)).toEqual(["permit", "posts"])
})

test("late days are unbounded, where the days ahead stop at seven", () => {
  // A horizon on what is LATE would be the page quietly dropping the one answer
  // no day page can give. Ten slipped days, ten dots on the line.
  const slipped = derive(
    nodesOfFiles({
      "work.olai": Array.from({ length: 10 }, (_, index) => {
        const day = String(1 + index).padStart(2, "0")
        return `{"id":"d${day}","ord":"a${index}","title":"day ${day}","todo":true,"date":"2026-08-${day}"}`
      }).join("\n"),
    }),
  )
  expect(agendaOf(slipped, TODAY).overdue.length).toBe(10)
})

test("Today is dated work that is not finished — not the day page minus done", () => {
  const agenda = agendaOf(SET, TODAY)
  // `ferry` is a dated `todo`. `birthday` is an OCCURRENCE: on today's PAGE
  // and in the calendar, off this one — the agenda lists work, not bullets
  // pinned to a day. `visas` was finished this morning, so it is on today's
  // PAGE and not here either.
  expect(listed(agenda.today)).toEqual(["ferry"])
})

test("Upcoming is the next days that owe work, each one a day", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(agenda.upcoming.map((day) => day.date)).toEqual(["2026-08-14"])
  expect(listed(agenda.upcoming[0]!.groups)).toEqual(["pack"])
  // An occurrence ahead is not upcoming: a sleeper leaving on the 20th is on
  // that day's page, and nobody marked it work, so it is owed nowhere.
  expect(across(agenda.upcoming)).not.toContain("train")
})

test("a day whose only work is already done is not upcoming at all", () => {
  // `tickets` is scheduled for the 22nd and finished. `done` never appears on
  // this page, so the day it was the only thing on has nothing to show — and a
  // heading linking to an empty section is worse than no heading.
  expect(agendaOf(SET, TODAY).upcoming.map((day) => day.date)).not.toContain("2026-08-22")
})

test("undated work is absent from the whole page", () => {
  const agenda = agendaOf(SET, TODAY)
  const everywhere = [
    ...across(agenda.overdue),
    ...listed(agenda.today),
    ...across(agenda.upcoming),
  ]
  // `paint` is work nobody scheduled and `filed` is work whose only date is on
  // its mark. Neither has a WHEN, and inventing one is what this refuses to do.
  expect(everywhere).not.toContain("paint")
  expect(everywhere).not.toContain("filed")
  // Nor does anything finished appear anywhere on it.
  expect(everywhere).not.toContain("survey")
  expect(everywhere).not.toContain("visas")
  expect(everywhere).not.toContain("tickets")
})

test("an occurrence whose day has passed simply leaves", () => {
  // `delivery` was the 4th and carries no mark. It is not overdue, and its day
  // is behind us, so it is on no section of the agenda — while it is still on
  // the 4th's own page, where a reader can go and find it.
  expect(across(agendaOf(SET, TODAY).overdue)).not.toContain("delivery")
})

test("a dated bullet is not on the agenda, wherever its day sits", () => {
  // The ruling this item is (`agenda-only-todo`): the agenda lists WORK —
  // dated `todo` and dated `doing` — and a bare dated bullet stays on its
  // day page and in the calendar dots. One of each stretch, so a filter
  // written three times cannot get one of them wrong.
  const agenda = agendaOf(SET, TODAY)
  const everywhere = [
    ...across(agenda.overdue),
    ...listed(agenda.today),
    ...across(agenda.upcoming),
  ]
  expect(everywhere).not.toContain("delivery")
  expect(everywhere).not.toContain("birthday")
  expect(everywhere).not.toContain("train")
  expect(everywhere).toContain("posts")
  expect(everywhere).toContain("permit")
  expect(everywhere).toContain("ferry")
  expect(everywhere).toContain("pack")
})

test("a dated `doing` today is owed the same as a dated `todo`", () => {
  // `doing` is a started todo (human, 2026-08-12 for Overdue; the same
  // predicate here). A narrower todo-only reading of the page was declined.
  const started = derive(
    nodesOfFiles({
      "work.olai":
        `{"id":"pour","ord":"a0","title":"pour the slab","doing":true,"date":"${TODAY}"}`,
    }),
  )
  const agenda = agendaOf(started, TODAY)
  expect(listed(agenda.today)).toEqual(["pour"])
  expect(owedOf(agenda)).toEqual({ overdue: 0, today: 1 })
})

test("an occurrence on today is not owed, and lights no mark", () => {
  const only = derive(
    nodesOfFiles({
      "life.olai":
        `{"id":"birthday","ord":"a0","title":"mum's birthday","date":"${TODAY}"}`,
    }),
  )
  const agenda = agendaOf(only, TODAY)
  expect(listed(agenda.today)).toEqual([])
  expect(nothingDue(agenda)).toBe(true)
  expect(owedOf(agenda)).toEqual({ overdue: 0, today: 0 })
})

test("every entry arrives situated, the way a day page's does", () => {
  // A title torn out of its outline says nothing, and the agenda collects from
  // all over the set — so the ancestry, the mark and what is in the way ride
  // along, computed by the same `situate` a day uses.
  const [permit] = agendaOf(SET, TODAY).overdue[0]!.groups[0]!.nodes
  expect(permit!.trail.map((crumb) => crumb.node.id)).toEqual(["deck"])
  expect(permit!.status).toBe("doing")
  expect(permit!.occasion).toBe("date")
  expect(permit!.date).toBe("2026-08-03")
})

test("a blocked task keeps both answers, and stays on the agenda", () => {
  // Being blocked is a SECOND fact about a node and never a replacement for the
  // first: a task that is late AND waiting on something is both, drawn together
  // (docs/format.md's Status).
  const blocked = derive(
    nodesOfFiles({
      "work.olai": [
        `{"id":"wire","ord":"a0","title":"wire the shed","todo":true,"date":"2026-08-01","after":["trench"]}`,
        `{"id":"trench","ord":"a1","title":"dig the trench","doing":true}`,
      ].join("\n"),
    }),
  )
  const [wire] = agendaOf(blocked, TODAY).overdue[0]!.groups[0]!.nodes
  expect(wire!.shows.node.id).toBe("wire")
  expect(wire!.blocked.map((one) => one.at.node.id)).toEqual(["trench"])
})

test("one row per node, even where a day holds both of its dates", () => {
  // A node scheduled for a past day and finished on another past day is on
  // neither: `done` extinguishes overdue. The half worth pinning is the shape —
  // what is behind us is built from the same bucketed walk, so a node can only
  // ever reach it through its `date`.
  const both = derive(
    nodesOfFiles({
      "work.olai": [
        `{"id":"open","ord":"a0","title":"still open","todo":true,"date":"2026-08-04"}`,
        `{"id":"shut","ord":"a1","title":"finished late","done":"2026-08-09T09:00:00-04:00","date":"2026-08-04"}`,
      ].join("\n"),
    }),
  )
  const [day, ...rest] = agendaOf(both, TODAY).overdue
  expect(rest).toEqual([])
  expect(listed(day!.groups)).toEqual(["open"])
})

test("a mirror is a placement, so late work is late once", () => {
  // The format gives a mirror no field to carry a date or a mark, and the
  // agenda asks the node rather than the places it is shown in.
  const mirrored = derive(
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-01"}`,
      "now.olai": `{"id":"posts-now","ord":"a0","mirror":"posts"}`,
    }),
  )
  expect(across(agendaOf(mirrored, TODAY).overdue)).toEqual(["posts"])
})

test("an agenda with nothing due says so, and says it once", () => {
  const bullets = derive(
    nodesOfFiles({
      "notes.olai": [
        `{"id":"deck","ord":"a0","title":"the deck"}`,
        `{"id":"idea","parent":"deck","ord":"a0","title":"maybe a pergola"}`,
      ].join("\n"),
    }),
  )
  const agenda = agendaOf(bullets, TODAY)
  expect(agenda).toEqual({ overdue: [], today: [], upcoming: [] })
  expect(nothingDue(agenda)).toBe(true)
  expect(nothingDue(agendaOf(SET, TODAY))).toBe(false)
})

test("Upcoming is bounded by the days it shows, not by a window of dates", () => {
  // A directory with something on every day for a fortnight shows the first
  // seven of them; the bound is a count of POPULATED days, which is what makes
  // it arithmetic-free (dates are text here as everywhere).
  const many = derive(
    nodesOfFiles({
      "work.olai": Array.from({ length: 14 }, (_, index) => {
        const day = String(13 + index).padStart(2, "0")
        return `{"id":"d${day}","ord":"a${index}","title":"day ${day}","todo":true,"date":"2026-08-${day}"}`
      }).join("\n"),
    }),
  )
  const upcoming = agendaOf(many, TODAY).upcoming
  expect(upcoming.length).toBe(UPCOMING_DAYS)
  expect(upcoming[0]!.date).toBe("2026-08-13")
  expect(upcoming.at(-1)!.date).toBe("2026-08-19")
})

// ── how much of it there is ────────────────────────────────────────────

test("the counts are the rows the page draws, across every outline", () => {
  const owed = owedOf(agendaOf(SET, TODAY))
  // `posts` and `permit` are late in one file. Today is `ferry` alone: the
  // birthday beside it is an occurrence, so it is a row today's PAGE draws
  // and this one does not. The task finished this morning is in neither.
  expect(owed).toEqual({ overdue: 2, today: 1 })
})

test("a count is of NODES, and never of the days or outlines holding them", () => {
  // The same two late tasks, one per file: a mark saying "2" means two things
  // are late, and a group-count would have said the same number for the wrong
  // reason — so they are split here on purpose.
  const spread = derive(
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-10"}`,
      "life.olai": `{"id":"visas","ord":"a0","title":"send the visa forms","todo":true,"date":"2026-08-09"}`,
    }),
  )
  const agenda = agendaOf(spread, TODAY)
  expect(agenda.overdue.length).toBe(2)
  expect(owedOf(agenda).overdue).toBe(2)
  // Two files on two days here; a set with both on ONE day is still two.
  const together = derive(
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-09"}`,
      "life.olai": `{"id":"visas","ord":"a0","title":"send the visa forms","todo":true,"date":"2026-08-09"}`,
    }),
  )
  expect(agendaOf(together, TODAY).overdue.length).toBe(1)
  expect(owedOf(agendaOf(together, TODAY)).overdue).toBe(2)
})

test("what is COMING is not owed: Upcoming is no part of the counts", () => {
  const ahead = derive(
    nodesOfFiles({
      "work.olai": `{"id":"pack","ord":"a0","title":"pack the bags","todo":true,"date":"2026-08-14"}`,
    }),
  )
  const agenda = agendaOf(ahead, TODAY)
  expect(agenda.upcoming.length).toBe(1)
  expect(owedOf(agenda)).toEqual({ overdue: 0, today: 0 })
})

test("nothing due is nothing counted", () => {
  expect(owedOf({ overdue: [], today: [], upcoming: [] })).toEqual({
    overdue: 0,
    today: 0,
  })
})

test("nothing put away is owed: the archive is the trash's and no page else's", () => {
  // The 2026-08-17 ruling, read on the page it was reported against. A node in
  // an archive still says `todo` and still names a day — and it is on no
  // section here, because putting something away is the reader saying they are
  // done looking at it. The one door left to it is `is:trashed`
  // (docs/search.md), and the one page is the trash.
  //
  // ONE OF EACH — slipped, due today, coming up — because the exclusion is the
  // bucketed walk's (./dates.ts) and so cannot reach one section and miss
  // another. A fixture holding only the late one would pass under a rule that
  // had been written three times and got one of them wrong.
  const archived: Derived = derive(
    nodesOfFiles({
      "_olai/Trash.olai": [
        `{"id":"gate","ord":"a0","title":"the old gate","todo":true,"date":"2026-08-01"}`,
        `{"id":"bell","ord":"a1","title":"the bell","doing":true,"date":"2026-08-12"}`,
        `{"id":"hedge","ord":"a2","title":"the hedge","todo":true,"date":"2026-08-14"}`,
      ].join("\n"),
    }),
  )
  const agenda = agendaOf(archived, TODAY)
  expect(agenda.overdue).toEqual([])
  expect(nothingDue(agenda)).toBe(true)
  // And the mark outside the page counts what the page draws, which is nothing.
  expect(owedOf(agenda)).toEqual({ overdue: 0, today: 0 })
})

test("a leftover Archive.olai is owed on no agenda either", () => {
  const leftover: Derived = derive(
    nodesOfFiles({
      "Archive.olai": [
        `{"id":"gate","ord":"a0","title":"the old gate","todo":true,"date":"2026-08-01"}`,
        `{"id":"bell","ord":"a1","title":"the bell","doing":true,"date":"2026-08-12"}`,
        `{"id":"hedge","ord":"a2","title":"the hedge","todo":true,"date":"2026-08-14"}`,
      ].join("\n"),
    }),
  )
  const agenda = agendaOf(leftover, TODAY)
  expect(agenda.overdue).toEqual([])
  expect(nothingDue(agenda)).toBe(true)
  expect(owedOf(agenda)).toEqual({ overdue: 0, today: 0 })
})

// ── the agenda, narrowed ───────────────────────────────────────────────
//
// The filter over the page (`@olai/web`), which is this answer with rows taken
// out of it rather than a second reading: what is owed does not change because
// somebody typed in a box, and the mark beside the page goes on counting the
// unnarrowed one.

/** The ids a query selects here — the page's own scope, which asks the archive
 *  for nothing: the agenda draws none of it, so the flag that excepts the rule
 *  belongs to the trash and to no page this file is about (./filter.ts). */
const selecting = (text: string): ReadonlySet<string> =>
  new Set(
    matching(SET, parseFilter(text, TODAY)).map(({ at }) => at.node.id),
  )

test("every stretch of the line narrows, and a day left with nothing leaves it", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(across(agenda.overdue)).toEqual(["permit", "posts"])
  expect(listed(agenda.today)).toEqual(["ferry"])

  const ferry = keepingOwed(agenda, selecting("ferry"))
  expect(ferry.overdue).toEqual([])
  expect(listed(ferry.today)).toEqual(["ferry"])
  expect(ferry.upcoming).toEqual([])
  // Nothing was re-derived: what is owed is unchanged, which is what the mark
  // in the directory column counts.
  expect(owedOf(agenda)).toEqual({ overdue: 2, today: 1 })
})

test("a day in Upcoming with nothing left leaves it, heading and all", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(agenda.upcoming.map((day) => day.date)).toEqual(["2026-08-14"])
  const packing = keepingOwed(agenda, selecting("pack"))
  expect(packing.upcoming.map((day) => day.date)).toEqual(["2026-08-14"])
  expect(listed(packing.upcoming[0]!.groups)).toEqual(["pack"])
  // A query nothing on the page answers empties all three.
  const none = keepingOwed(agenda, selecting("nothing-is-called-this"))
  expect(nothingDue(none)).toBe(true)
})

/** How many rows the PAGE draws, which is the second number in the filter
 *  bar's "1 of 6" — Upcoming included, where `owedOf` leaves it out because a
 *  task due next Tuesday is not news today. */
test("what an agenda draws is every row of the whole line", () => {
  const agenda = agendaOf(SET, TODAY)
  // Four rows of WORK: two late, ferry today, pack ahead. The birthday and
  // the sleeper are occurrences, so they are not rows this page draws.
  expect(owedIn(agenda)).toBe(4)
  expect(owedIn(keepingOwed(agenda, selecting("ferry")))).toBe(1)
  expect(owedIn({ overdue: [], today: [], upcoming: [] })).toBe(0)
})

// ── the spine: where a day sits, and how far away it feels ─────────────

test("a day says which side of now it is on, whatever shape its value is", () => {
  expect(feltOn("2026-08-10", TODAY).standing).toBe("late")
  expect(feltOn(TODAY, TODAY).standing).toBe("today")
  expect(feltOn("2026-08-14", TODAY).standing).toBe("ahead")
  // A datetime counts for its day at either end of it, exactly as `isOverdue`
  // reads one: the standing is a comparison of days, not of instants.
  expect(feltOn(`${TODAY}T09:00`, TODAY).standing).toBe("today")
  expect(feltOn("2026-08-11T23:50", TODAY).standing).toBe("late")
})

test("the distance is counted in days, and negative behind us", () => {
  expect(feltOn("2026-08-14", TODAY).days).toBe(2)
  expect(feltOn("2026-08-03", TODAY).days).toBe(-9)
  // Across a month, a year and a leap day, because a subtraction that walked
  // month lengths is exactly where those go wrong.
  expect(feltOn("2026-09-01", "2026-08-12").days).toBe(20)
  expect(feltOn("2028-03-01", "2028-02-28").days).toBe(2)
  expect(feltOn("2027-08-12", "2026-08-12").days).toBe(365)
})

test("the three days either side of now are NAMED, not counted", () => {
  const distance = (date: string): string | undefined =>
    feltOn(date, TODAY).distance
  expect(distance(TODAY)).toBe("Today")
  expect(distance("2026-08-13")).toBe("Tomorrow")
  expect(distance("2026-08-11")).toBe("Yesterday")
})

test("felt distance: days under a fortnight, then weeks, then months", () => {
  // The design's own examples, read back off the arithmetic: "in 6 days",
  // "in 3 weeks", "in 2½ months" (roadmap `agenda-spine`, 2026-08-18).
  const distance = (date: string): string | undefined =>
    feltOn(date, "2026-08-18").distance
  expect(distance("2026-08-24")).toBe("in 6 days")
  expect(distance("2026-09-06")).toBe("in 3 weeks")
  expect(distance("2026-09-08")).toBe("in 3 weeks")
  expect(distance("2026-10-30")).toBe("in 2½ months")
  // Behind us, the same magnitudes in the past tense.
  expect(distance("2026-08-15")).toBe("3 days ago")
  expect(distance("2026-06-18")).toBe("2 months ago")
  // And a band past the design's, because this suite's own fixtures are dated
  // in 2019: "2478 days ago" is a number, not a distance. Halves carry all the
  // way out, which is what keeps the last band from flattening seven years and
  // six and a half into one word.
  expect(distance("2019-11-05")).toBe("7 years ago")
  expect(distance("2020-02-18")).toBe("6½ years ago")
})

test("a day says itself in words: weekday, month, number", () => {
  expect(feltOn("2026-08-24", "2026-08-18").calendar).toBe("Mon, Aug 24")
  expect(feltOn("2026-08-18", "2026-08-18").calendar).toBe("Tue, Aug 18")
  expect(feltOn("2026-10-30", "2026-08-18").calendar).toBe("Fri, Oct 30")
  // A datetime is drawn as its day; the time is the pill's business.
  expect(feltOn("2026-09-08T14:00", "2026-08-18").calendar).toBe("Tue, Sep 8")
})

test("the future recedes: a fade and an ink that ramp with distance", () => {
  const felt = (date: string): Felt => feltOn(date, "2026-08-18")
  // Everything behind now and everything inside a week is at full strength —
  // a week is the horizon a person plans against.
  expect(felt("2026-08-17")).toMatchObject({ fade: 1, tone: "alarm" })
  expect(felt("2026-08-18")).toMatchObject({ fade: 1, tone: "accent" })
  expect(felt("2026-08-24")).toMatchObject({ fade: 1, tone: "ink" })
  // Then it rolls off, and the four values the design named are this ramp
  // sampled: ~1 → 0.78 → 0.74 → 0.5.
  expect(felt("2026-09-06")).toMatchObject({ fade: 0.8, tone: "muted" })
  expect(felt("2026-09-08")).toMatchObject({ fade: 0.78, tone: "muted" })
  expect(felt("2026-10-30")).toMatchObject({ fade: 0.53, tone: "rule" })
  // And it has a FLOOR: a row nobody can read is a row not worth drawing.
  expect(felt("2036-10-30").fade).toBe(0.5)
})

test("a value that names no calendar day is COMPARED, and never counted", () => {
  // `2026-02-30` is day-SHAPED and is not a day — and the format's own parser
  // refuses it (./parse.ts checks calendar reality), so nothing on a page ever
  // reaches here like this. What the shape promises is that this function is
  // total: the standing is still answerable by comparison, and the distance
  // says NOTHING rather than the "0 days ago" a zero would have printed under
  // a heading that had just said the day was late.
  const felt = feltOn("2026-02-30", TODAY)
  expect(felt.standing).toBe("late")
  expect(felt.days).toBeUndefined()
  expect(felt.distance).toBeUndefined()
  expect(felt.calendar).toBe("2026-02-30")
  // And it is drawn at the near end of the ramp rather than faded out of sight.
  expect(felt.fade).toBe(1)
  expect(felt.tone).toBe("alarm")
})

// ── the silences between days ──────────────────────────────────────────

test("a wait under a fortnight is whitespace and says nothing", () => {
  expect(quietBetween("2026-08-18", "2026-08-20").label).toBeUndefined()
  expect(quietBetween("2026-08-18", "2026-08-24").label).toBeUndefined()
})

test("a wait worth noticing is CALLED what it is, in words", () => {
  // The design's own two labels, off the arithmetic.
  expect(quietBetween("2026-08-24", "2026-09-06").label).toBe("two quiet weeks")
  expect(quietBetween("2026-09-08", "2026-10-30").label).toBe("seven quiet weeks")
  // Past two months it counts in months, and past eighteen in years — with the
  // numeral rather than a word once it carries a half.
  expect(quietBetween("2026-01-01", "2026-05-01").label).toBe("four quiet months")
  expect(quietBetween("2019-11-05", "2026-08-18").label).toBe("seven quiet years")
  expect(quietBetween("2020-02-18", "2026-08-18").label).toBe("6½ quiet years")
})

test("a thirteen-day silence is two weeks where a thirteen-day distance is days", () => {
  // The one place the two bandings differ, and it is deliberate: a distance is
  // counted from now and somebody is planning against it, a wait is counted
  // between two things and nobody is.
  expect(quietBetween("2026-08-18", "2026-08-31").label).toBe("two quiet weeks")
  expect(feltOn("2026-08-31", "2026-08-18").distance).toBe("in 13 days")
})

test("the room a wait takes grows log-ish, and is clamped at both ends", () => {
  const space = (from: string, to: string): number => quietBetween(from, to).space
  const two = space("2026-08-18", "2026-08-20")
  const thirteen = space("2026-08-18", "2026-08-31")
  const fifty = space("2026-08-18", "2026-10-07")
  expect(two).toBeLessThan(thirteen)
  expect(thirteen).toBeLessThan(fifty)
  // Never linear: fifty days is not twenty-five times two days.
  expect(fifty).toBeLessThan(two * 4)
  // A day either way is the floor, and seven years is the ceiling — a silence
  // has to read as longer without costing a screen.
  expect(space("2026-08-18", "2026-08-18")).toBe(1)
  expect(space("2019-11-05", "2026-08-18")).toBe(5)
})

// ── what a row's pill still has to say ─────────────────────────────────

/** The day a row sits under, felt from today — which is what the pill is
 *  handed, because every row of a day is late by exactly that day's distance. */
const dayFelt = (date: string, today: string): Felt => feltOn(date, today)

test("a late row says HOW late, and that is the pill's whole content", () => {
  const fact = (date: string): string | undefined =>
    owedFact(date, true, dayFelt(date, "2026-08-18"))
  expect(fact("2026-08-17")).toBe("1 day late")
  expect(fact("2026-08-15")).toBe("3 days late")
  expect(fact("2019-11-05")).toBe("7 years late")
})

test("a row ahead says nothing, unless it names a TIME", () => {
  // The day it is under has already said the date; a pill repeating it is the
  // chrome this page was redrawn to be rid of.
  const fact = (date: string): string | undefined =>
    owedFact(date, false, dayFelt(date, "2026-08-18"))
  expect(fact("2026-08-24")).toBeUndefined()
  expect(fact("2026-09-08T14:00")).toBe("14:00")
  // Seconds and an offset are past the time of day and are not printed.
  expect(fact("2026-09-08T14:00:00-04:00")).toBe("14:00")
})

test("lateness is asked of the MARK, never of the date alone", () => {
  // An occurrence in the past is not late work, and nothing here may decide
  // otherwise: the row has already asked `isOverdue` of the node.
  expect(owedFact("2026-08-17", false, dayFelt("2026-08-17", "2026-08-18")))
    .toBeUndefined()
})
