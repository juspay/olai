import { expect, test } from "bun:test"

import { agendaOf, isOverdue, nothingDue, UPCOMING_DAYS } from "./agenda.ts"
import { derive, type Derived } from "./derive.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
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
    "work.jsonl": [
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
    "life.jsonl": [
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

/** The ids a section lists, across its groups and in the order it lists them —
 *  the membership and the order are one promise. */
const listed = (
  groups: ReadonlyArray<{ readonly nodes: ReadonlyArray<{ readonly shows: Located }> }>,
): ReadonlyArray<string> =>
  groups.flatMap((group) => group.nodes.map((entry) => entry.shows.node.id))

const node = (source: string): RegularNode =>
  nodesOfFiles({ "a.jsonl": source })[0]!.node as RegularNode

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

test("a task with no date is not late — it has no WHEN to be late against", () => {
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true}`), TODAY)).toBe(false)
  // Nor is a date on the mark itself one: filing a task on Tuesday says nothing
  // about when it is due, and no view reads it as a day.
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":"2026-07-30"}`), TODAY))
    .toBe(false)
})

// ── the page ───────────────────────────────────────────────────────────

test("Overdue is every slipped task in the set, oldest first, grouped by outline", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(agenda.overdue.map((group) => group.file)).toEqual(["work.jsonl"])
  expect(listed(agenda.overdue)).toEqual(["permit", "posts"])
})

test("Today is the day page's answer, minus what is finished", () => {
  const agenda = agendaOf(SET, TODAY)
  // The occurrence keeps its place — it is on today, and it is not work — and
  // it comes first, a bare date being the day itself and so the earliest thing
  // in it. `visas` was finished this morning, so it is on today's PAGE and not
  // here.
  expect(listed(agenda.today)).toEqual(["birthday", "ferry"])
})

test("Upcoming is the next days that have anything, each one a day", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(agenda.upcoming.map((day) => day.date)).toEqual(["2026-08-14", "2026-08-20"])
  expect(listed(agenda.upcoming[0]!.groups)).toEqual(["pack"])
  // An occurrence is upcoming like anything else: a sleeper leaving on the 20th
  // is a thing that is coming, and nobody has to have marked it work.
  expect(listed(agenda.upcoming[1]!.groups)).toEqual(["train"])
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
    ...listed(agenda.overdue),
    ...listed(agenda.today),
    ...agenda.upcoming.flatMap((day) => listed(day.groups)),
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
  expect(listed(agendaOf(SET, TODAY).overdue)).not.toContain("delivery")
})

test("every entry arrives situated, the way a day page's does", () => {
  // A title torn out of its outline says nothing, and the agenda collects from
  // all over the set — so the ancestry, the mark and what is in the way ride
  // along, computed by the same `situate` a day uses.
  const [permit] = agendaOf(SET, TODAY).overdue[0]!.nodes
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
      "work.jsonl": [
        `{"id":"wire","ord":"a0","title":"wire the shed","todo":true,"date":"2026-08-01","after":["trench"]}`,
        `{"id":"trench","ord":"a1","title":"dig the trench","doing":true}`,
      ].join("\n"),
    }),
  )
  const [wire] = agendaOf(blocked, TODAY).overdue[0]!.nodes
  expect(wire!.shows.node.id).toBe("wire")
  expect(wire!.blocked.map((one) => one.at.node.id)).toEqual(["trench"])
})

test("a mirror is a placement, so late work is late once", () => {
  // The format gives a mirror no field to carry a date or a mark, and the
  // agenda asks the node rather than the places it is shown in.
  const mirrored = derive(
    nodesOfFiles({
      "work.jsonl": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-01"}`,
      "now.jsonl": `{"id":"posts-now","ord":"a0","mirror":"posts"}`,
    }),
  )
  expect(listed(agendaOf(mirrored, TODAY).overdue)).toEqual(["posts"])
})

test("an agenda with nothing due says so, and says it once", () => {
  const bullets = derive(
    nodesOfFiles({
      "notes.jsonl": [
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
      "work.jsonl": Array.from({ length: 14 }, (_, index) => {
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

test("the archive keeps its place, for the reason a day page keeps it", () => {
  // Blockedness exempts archived work because nothing can wait on work that is
  // over; a day asks the other question and so does this. A node put away still
  // says `todo` and still names a day, and its group heading says where it now
  // lives.
  const archived: Derived = derive(
    nodesOfFiles({
      "Archive.jsonl": `{"id":"gate","ord":"a0","title":"the old gate","todo":true,"date":"2026-08-01"}`,
    }),
  )
  expect(agendaOf(archived, TODAY).overdue.map((group) => group.file)).toEqual([
    "Archive.jsonl",
  ])
})
