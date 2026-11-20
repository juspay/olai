import { TEST_CLAIMS } from "@olai/format/testlib"
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
  owedNow,
  owedOf,
  owedReading,
  owedRows,
  quietBetween,
  UPCOMING_DAYS,
} from "./agenda.ts"
import { derive, type Derived } from "./derive.ts"
import { matching, parseFilter } from "./filter.ts"
import type { Dated } from "./occasion.ts"
import { nodesOf, nodesOfFiles } from "./fixtures.testlib.ts"
import { type Located, type RegularNode } from "./node.ts"
const TODAY = "2026-08-12"

const SET = derive(TEST_CLAIMS,
  nodesOfFiles({
    "work.olai": [
      `{"id":"deck","ord":"a0","title":"the deck"}`,
      `{"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-10"}`,
      `{"id":"permit","parent":"deck","ord":"a1","title":"pull the permit","doing":true,"date":"2026-08-03"}`,
      `{"id":"delivery","parent":"deck","ord":"a2","title":"the timber arrives","date":"2026-08-04"}`,
      `{"id":"survey","ord":"a1","title":"the boundary survey","done":"2026-08-05T09:15:00-04:00","date":"2026-08-05"}`,
      `{"id":"paint","ord":"a2","title":"paint the rails","todo":true}`,
      `{"id":"filed","ord":"a3","title":"replace the gate latch","todo":"2026-07-30"}`,
    ].join("\n"),
    "life.olai": [
      `{"id":"trip","ord":"a0","title":"the coast trip"}`,
      `{"id":"ferry","parent":"trip","ord":"a0","title":"book the ferry","todo":true,"date":"2026-08-12T09:00"}`,
      `{"id":"birthday","parent":"trip","ord":"a1","title":"mum's birthday","date":"2026-08-12"}`,
      `{"id":"visas","parent":"trip","ord":"a2","title":"send the visa forms","done":"2026-08-12T08:00:00-04:00","date":"2026-08-12"}`,
      `{"id":"pack","parent":"trip","ord":"a3","title":"pack the bags","todo":true,"date":"2026-08-14"}`,
      `{"id":"train","parent":"trip","ord":"a4","title":"the sleeper leaves","date":"2026-08-20T21:40"}`,
      `{"id":"tickets","parent":"trip","ord":"a5","title":"print the tickets","done":true,"date":"2026-08-22"}`,
    ].join("\n"),
  }),
)

const listed = (
  groups: ReadonlyArray<{ readonly nodes: ReadonlyArray<{ readonly shows: Located }> }>,
): ReadonlyArray<string> =>
  groups.flatMap((group) => group.nodes.map((entry) => entry.shows.node.id))

const across = (days: ReadonlyArray<AgendaDay>): ReadonlyArray<string> =>
  days.flatMap((day) => listed(day.groups))

const node = (source: string): RegularNode => nodesOf(source)[0]!.node as RegularNode

test("a dated `todo` before today is overdue, and a dated `doing` is too", () => {
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true,"date":"2026-08-10"}`), TODAY))
    .toBe(true)
  expect(
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","doing":true,"date":"2026-08-10"}`), TODAY),
  ).toBe(true)
})

test("a dated bullet is never overdue, however long ago its day was", () => {
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","date":"1994-03-02"}`), TODAY))
    .toBe(false)
})

test("either SETTLING mark extinguishes it — a settled task is late at nothing", () => {
  expect(
    isOverdue(
      node(`{"id":"a","ord":"a0","title":"a","done":"2026-08-11T09:00:00-04:00","date":"2026-08-01"}`),
      TODAY,
    ),
  ).toBe(false)
  expect(
    isOverdue(
      node(
        `{"id":"a","ord":"a0","title":"a","cancelled":"2026-08-11T09:00:00-04:00","date":"2026-08-01"}`,
      ),
      TODAY,
    ),
  ).toBe(false)
  expect(
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","cancelled":true,"date":"2026-08-01"}`), TODAY),
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
  const due = (date: string): boolean =>
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true,"date":"${date}"}`), TODAY)
  expect(due("2026-08-11T23:50")).toBe(true)
  expect(due(`${TODAY}T00:01`)).toBe(false)
  expect(due("2026-08-11T22:00:00-04:00")).toBe(true)
})

test("an instant for TODAY still names a day, on the caller's side too", () => {
  const due = (date: string, now: string): boolean =>
    isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true,"date":"${date}"}`), now)
  expect(due(TODAY, `${TODAY}T09:00`)).toBe(false)
  expect(due(`${TODAY}T08:00`, `${TODAY}T09:00`)).toBe(false)
  expect(due("2026-08-11", `${TODAY}T00:00:00-04:00`)).toBe(true)
})

test("a task with no date is not late — it has no WHEN to be late against", () => {
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":true}`), TODAY)).toBe(false)
  expect(isOverdue(node(`{"id":"a","ord":"a0","title":"a","todo":"2026-07-30"}`), TODAY))
    .toBe(false)
})

test("what slipped arrives as DAYS, oldest first, each grouped by outline", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(agenda.overdue.map((day) => day.date)).toEqual(["2026-08-03", "2026-08-10"])
  expect(agenda.overdue.map((day) => day.groups.map((group) => group.file)))
    .toEqual([["work.olai"], ["work.olai"]])
  expect(across(agenda.overdue)).toEqual(["permit", "posts"])
})

test("late days are unbounded, where the days ahead stop at seven", () => {
  const slipped = derive(TEST_CLAIMS,
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
  expect(listed(agenda.today)).toEqual(["ferry"])
})

test("Upcoming is the next days that owe work, each one a day", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(agenda.upcoming.map((day) => day.date)).toEqual(["2026-08-14"])
  expect(listed(agenda.upcoming[0]!.groups)).toEqual(["pack"])
  expect(across(agenda.upcoming)).not.toContain("train")
})

test("a day whose only work is already done is not upcoming at all", () => {
  expect(agendaOf(SET, TODAY).upcoming.map((day) => day.date)).not.toContain("2026-08-22")
})

test("undated work is absent from the whole page", () => {
  const agenda = agendaOf(SET, TODAY)
  const everywhere = [
    ...across(agenda.overdue),
    ...listed(agenda.today),
    ...across(agenda.upcoming),
  ]
  expect(everywhere).not.toContain("paint")
  expect(everywhere).not.toContain("filed")
  expect(everywhere).not.toContain("survey")
  expect(everywhere).not.toContain("visas")
  expect(everywhere).not.toContain("tickets")
})

test("an occurrence whose day has passed simply leaves", () => {
  expect(across(agendaOf(SET, TODAY).overdue)).not.toContain("delivery")
})

test("a dated bullet is not on the agenda, wherever its day sits", () => {
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
  const started = derive(TEST_CLAIMS,
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
  const only = derive(TEST_CLAIMS,
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
  const [permit] = agendaOf(SET, TODAY).overdue[0]!.groups[0]!.nodes
  expect(permit!.trail.map((crumb) => crumb.node.id)).toEqual(["deck"])
  expect(permit!.status).toBe("doing")
  expect(permit!.occasion).toBe("date")
  expect(permit!.date).toBe("2026-08-03")
})

test("a blocked task keeps both answers, and stays on the agenda", () => {
  const blocked = derive(TEST_CLAIMS,
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
  const both = derive(TEST_CLAIMS,
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
  const mirrored = derive(TEST_CLAIMS,
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-01"}`,
      "now.olai": `{"id":"posts-now","ord":"a0","mirror":"posts"}`,
    }),
  )
  expect(across(agendaOf(mirrored, TODAY).overdue)).toEqual(["posts"])
})

test("an agenda with nothing due says so, and says it once", () => {
  const bullets = derive(TEST_CLAIMS,
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
  const many = derive(TEST_CLAIMS,
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

test("the counts are the rows the page draws, across every outline", () => {
  const owed = owedOf(agendaOf(SET, TODAY))
  expect(owed).toEqual({ overdue: 2, today: 1 })
})

test("a count is of NODES, and never of the days or outlines holding them", () => {
  const spread = derive(TEST_CLAIMS,
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-10"}`,
      "life.olai": `{"id":"visas","ord":"a0","title":"send the visa forms","todo":true,"date":"2026-08-09"}`,
    }),
  )
  const agenda = agendaOf(spread, TODAY)
  expect(agenda.overdue.length).toBe(2)
  expect(owedOf(agenda).overdue).toBe(2)
  const together = derive(TEST_CLAIMS,
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-09"}`,
      "life.olai": `{"id":"visas","ord":"a0","title":"send the visa forms","todo":true,"date":"2026-08-09"}`,
    }),
  )
  expect(agendaOf(together, TODAY).overdue.length).toBe(1)
  expect(owedOf(agendaOf(together, TODAY)).overdue).toBe(2)
})

test("what is COMING is not owed: Upcoming is no part of the counts", () => {
  const ahead = derive(TEST_CLAIMS,
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

test("the counts off the index are the counts off the page, on the same set", () => {
  for (
    const today of [
      "2026-08-01",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-10",
      TODAY,
      "2026-08-14",
      "2026-08-20",
      "2026-08-22",
      "2027-01-01",
    ]
  ) {
    expect([today, owedNow(SET, today)]).toEqual([today, owedOf(agendaOf(SET, today))])
  }
  expect(owedNow(SET, TODAY)).toEqual({ overdue: 2, today: 1 })
})

test("the day rolls over and the same task moves from Today to late, once", () => {
  const due = derive(TEST_CLAIMS,
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-11"}`,
    }),
  )
  expect(owedNow(due, "2026-08-10")).toEqual({ overdue: 0, today: 0 })
  expect(owedNow(due, "2026-08-11")).toEqual({ overdue: 0, today: 1 })
  expect(owedNow(due, "2026-08-12")).toEqual({ overdue: 1, today: 0 })
  for (const today of ["2026-08-10", "2026-08-11", "2026-08-12"]) {
    expect([today, owedNow(due, today)]).toEqual([today, owedOf(agendaOf(due, today))])
  }
})

const rowIds = (rows: ReadonlyArray<{ readonly id: string }>): ReadonlyArray<string> =>
  rows.map((row) => row.id)

test("the rows are the page's own first rows: oldest day first, then today's", () => {
  expect(rowIds(owedRows(SET, TODAY, 10))).toEqual(["permit", "posts", "ferry"])
  expect(owedReading(SET, TODAY, 2)).toEqual({
    overdue: 2,
    today: 1,
    rows: [
      {
        id: "permit",
        file: "work.olai",
        title: "pull the permit",
        date: "2026-08-03",
        status: "doing",
      },
      {
        id: "posts",
        file: "work.olai",
        title: "dig the post holes",
        date: "2026-08-10",
        status: "todo",
      },
    ],
  })
})

test("what is never a row: an occurrence, finished work, an undated task, a dated mark", () => {
  const ids = rowIds(owedRows(SET, TODAY, 10))
  for (const never of ["delivery", "survey", "paint", "filed", "birthday", "visas"]) {
    expect([never, ids.includes(never)]).toEqual([never, false])
  }
})

test("the cap bounds the rows and never the counts", () => {
  expect(rowIds(owedRows(SET, TODAY, 0))).toEqual([])
  expect(rowIds(owedRows(SET, TODAY, 1))).toEqual(["permit"])
  expect(rowIds(owedRows(SET, TODAY, Number.NaN))).toEqual([])
  expect(rowIds(owedRows(SET, TODAY, 2.7))).toEqual(["permit", "posts"])
  expect(rowIds(owedRows(SET, TODAY, 99))).toEqual(["permit", "posts", "ferry"])
  for (const cap of [0, 1, 2, 3, 99]) {
    expect([cap, owedReading(SET, TODAY, cap).overdue, owedReading(SET, TODAY, cap).today])
      .toEqual([cap, 2, 1])
  }
})

test("rows on one day come in the order the page draws them: outline, then time", () => {
  const day = "2026-08-05"
  const several = derive(TEST_CLAIMS,
    nodesOfFiles({
      "zeta.olai": [
        `{"id":"late-in-zeta","ord":"a0","title":"late in zeta","todo":true,"date":"${day}"}`,
      ].join("\n"),
      "alpha.olai": [
        `{"id":"at-two","ord":"a0","title":"at two","todo":true,"date":"${day}T14:00"}`,
        `{"id":"bare","ord":"a1","title":"bare","doing":true,"date":"${day}"}`,
      ].join("\n"),
    }),
  )
  const page = agendaOf(several, "2026-08-20").overdue[0]!
  expect(page.groups.flatMap((group) => group.nodes).map((entry) => entry.shows.node.id))
    .toEqual(["bare", "at-two", "late-in-zeta"])
  expect(rowIds(owedRows(several, "2026-08-20", 10))).toEqual(["bare", "at-two", "late-in-zeta"])
})

test("a today row is the day the caller named, exactly as the count is", () => {
  const instant = "2026-08-12T09:00:00-04:00"
  const reading = owedReading(SET, instant, 10)
  expect({ ...reading, rows: rowIds(reading.rows) })
    .toEqual({ overdue: 2, today: 0, rows: ["permit", "posts"] })
})

test("the rows STOP at the days they need — the days behind them are never read", () => {
  const lines = [`{"id":"root","ord":"a0","title":"the root"}`]
  for (let day = 1; day <= 28; day++) {
    const date = `2026-01-${String(day).padStart(2, "0")}`
    lines.push(
      `{"id":"n${day}","parent":"root","ord":"a${day.toString(36)}","title":"day ${day}","todo":true,"date":"${date}"}`,
    )
  }
  const view = derive(TEST_CLAIMS, nodesOfFiles({ "work.olai": lines.join("\n") }))

  class Counted extends Map<string, ReadonlyArray<Dated>> {
    reads = 0
    override get(day: string) {
      this.reads += 1
      return super.get(day)
    }
  }
  const buckets = new Counted(view.byDay)
  const counted = { ...view, byDay: buckets }

  expect(rowIds(owedRows(counted, "2026-02-01", 5))).toEqual(["n1", "n2", "n3", "n4", "n5"])
  expect(buckets.reads).toBe(5)
})

test("an INSTANT for today counts what a plain day counts, on both spellings", () => {
  const due = derive(TEST_CLAIMS,
    nodesOfFiles({
      "work.olai": `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-11"}`,
    }),
  )
  const instant = "2026-08-11T09:00:00-04:00"
  expect(owedNow(due, instant).overdue).toBe(0)
  expect(owedNow(due, instant)).toEqual(owedOf(agendaOf(due, instant)))
})

test("finishing today's work today empties the count, and the day with it", () => {
  const before = `{"id":"ferry","ord":"a0","title":"book the ferry","todo":true,"date":"2026-08-12"}`
  const after =
    `{"id":"ferry","ord":"a0","title":"book the ferry","done":"2026-08-12T10:00:00-04:00","date":"2026-08-12"}`
  const open = derive(TEST_CLAIMS, nodesOfFiles({ "life.olai": before }))
  const shut = derive(TEST_CLAIMS, nodesOfFiles({ "life.olai": after }))

  expect(owedNow(open, TODAY)).toEqual({ overdue: 0, today: 1 })
  expect(owedNow(shut, TODAY)).toEqual({ overdue: 0, today: 0 })
  expect(shut.byDay.has(TODAY)).toBe(true)
  expect(shut.owedByDay.has(TODAY)).toBe(false)
  expect(owedNow(shut, TODAY)).toEqual(owedOf(agendaOf(shut, TODAY)))
})

test("finishing LATE work today takes it off the late count on the same read", () => {
  const late = `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-10"}`
  const done =
    `{"id":"posts","ord":"a0","title":"dig the post holes","done":"2026-08-12T10:00:00-04:00","date":"2026-08-10"}`
  const owing = derive(TEST_CLAIMS, nodesOfFiles({ "work.olai": late }))
  const settled = derive(TEST_CLAIMS, nodesOfFiles({ "work.olai": done }))

  expect(owedNow(owing, TODAY)).toEqual({ overdue: 1, today: 0 })
  expect(owedNow(settled, TODAY)).toEqual({ overdue: 0, today: 0 })
  expect(settled.byDay.has("2026-08-10")).toBe(true)
  expect(settled.owedByDay.has("2026-08-10")).toBe(false)
  expect(owedNow(settled, TODAY)).toEqual(owedOf(agendaOf(settled, TODAY)))
})

test("a day the index holds owes exactly what that day's page draws", () => {
  expect([...SET.owedByDay]).toEqual([["2026-08-03", 1], ["2026-08-10", 1], [
    "2026-08-12",
    1,
  ], ["2026-08-14", 1]])
  expect(SET.days).toEqual([
    "2026-08-03",
    "2026-08-04",
    "2026-08-05",
    "2026-08-10",
    "2026-08-12",
    "2026-08-14",
    "2026-08-20",
    "2026-08-22",
  ])
})

test("nothing put away is owed: the archive is the trash's and no page else's", () => {
  const archived: Derived = derive(TEST_CLAIMS,
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
  expect(owedOf(agenda)).toEqual({ overdue: 0, today: 0 })
  expect(owedNow(archived, TODAY)).toEqual({ overdue: 0, today: 0 })
  expect(archived.owedByDay.size).toBe(0)
})

test("a leftover Archive.olai is owed on no agenda either", () => {
  const leftover: Derived = derive(TEST_CLAIMS,
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
  expect(owedNow(leftover, TODAY)).toEqual({ overdue: 0, today: 0 })
  expect(leftover.owedByDay.size).toBe(0)
})

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
  expect(owedOf(agenda)).toEqual({ overdue: 2, today: 1 })
})

test("a day in Upcoming with nothing left leaves it, heading and all", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(agenda.upcoming.map((day) => day.date)).toEqual(["2026-08-14"])
  const packing = keepingOwed(agenda, selecting("pack"))
  expect(packing.upcoming.map((day) => day.date)).toEqual(["2026-08-14"])
  expect(listed(packing.upcoming[0]!.groups)).toEqual(["pack"])
  const none = keepingOwed(agenda, selecting("nothing-is-called-this"))
  expect(nothingDue(none)).toBe(true)
})

test("what an agenda draws is every row of the whole line", () => {
  const agenda = agendaOf(SET, TODAY)
  expect(owedIn(agenda)).toBe(4)
  expect(owedIn(keepingOwed(agenda, selecting("ferry")))).toBe(1)
  expect(owedIn({ overdue: [], today: [], upcoming: [] })).toBe(0)
})

test("a day says which side of now it is on, whatever shape its value is", () => {
  expect(feltOn("2026-08-10", TODAY).standing).toBe("late")
  expect(feltOn(TODAY, TODAY).standing).toBe("today")
  expect(feltOn("2026-08-14", TODAY).standing).toBe("ahead")
  expect(feltOn(`${TODAY}T09:00`, TODAY).standing).toBe("today")
  expect(feltOn("2026-08-11T23:50", TODAY).standing).toBe("late")
})

test("the distance is counted in days, and negative behind us", () => {
  expect(feltOn("2026-08-14", TODAY).days).toBe(2)
  expect(feltOn("2026-08-03", TODAY).days).toBe(-9)
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
  const distance = (date: string): string | undefined =>
    feltOn(date, "2026-08-18").distance
  expect(distance("2026-08-24")).toBe("in 6 days")
  expect(distance("2026-09-06")).toBe("in 3 weeks")
  expect(distance("2026-09-08")).toBe("in 3 weeks")
  expect(distance("2026-10-30")).toBe("in 2½ months")
  expect(distance("2026-08-15")).toBe("3 days ago")
  expect(distance("2026-06-18")).toBe("2 months ago")
  expect(distance("2019-11-05")).toBe("7 years ago")
  expect(distance("2020-02-18")).toBe("6½ years ago")
})

test("a day says itself in words: weekday, month, number", () => {
  expect(feltOn("2026-08-24", "2026-08-18").calendar).toBe("Mon, Aug 24")
  expect(feltOn("2026-08-18", "2026-08-18").calendar).toBe("Tue, Aug 18")
  expect(feltOn("2026-10-30", "2026-08-18").calendar).toBe("Fri, Oct 30")
  expect(feltOn("2026-09-08T14:00", "2026-08-18").calendar).toBe("Tue, Sep 8")
})

test("the future recedes: a fade and an ink that ramp with distance", () => {
  const felt = (date: string): Felt => feltOn(date, "2026-08-18")
  expect(felt("2026-08-17")).toMatchObject({ fade: 1, tone: "alarm" })
  expect(felt("2026-08-18")).toMatchObject({ fade: 1, tone: "accent" })
  expect(felt("2026-08-24")).toMatchObject({ fade: 1, tone: "ink" })
  expect(felt("2026-09-06")).toMatchObject({ fade: 0.8, tone: "muted" })
  expect(felt("2026-09-08")).toMatchObject({ fade: 0.78, tone: "muted" })
  expect(felt("2026-10-30")).toMatchObject({ fade: 0.53, tone: "rule" })
  expect(felt("2036-10-30").fade).toBe(0.5)
})

test("a value that names no calendar day is COMPARED, and never counted", () => {
  const felt = feltOn("2026-02-30", TODAY)
  expect(felt.standing).toBe("late")
  expect(felt.days).toBeUndefined()
  expect(felt.distance).toBeUndefined()
  expect(felt.calendar).toBe("2026-02-30")
  expect(felt.fade).toBe(1)
  expect(felt.tone).toBe("alarm")
})

test("a wait under a fortnight is whitespace and says nothing", () => {
  expect(quietBetween("2026-08-18", "2026-08-20").label).toBeUndefined()
  expect(quietBetween("2026-08-18", "2026-08-24").label).toBeUndefined()
})

test("a wait worth noticing is CALLED what it is, in words", () => {
  expect(quietBetween("2026-08-24", "2026-09-06").label).toBe("two quiet weeks")
  expect(quietBetween("2026-09-08", "2026-10-30").label).toBe("seven quiet weeks")
  expect(quietBetween("2026-01-01", "2026-05-01").label).toBe("four quiet months")
  expect(quietBetween("2019-11-05", "2026-08-18").label).toBe("seven quiet years")
  expect(quietBetween("2020-02-18", "2026-08-18").label).toBe("6½ quiet years")
})

test("a thirteen-day silence is two weeks where a thirteen-day distance is days", () => {
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
  expect(fifty).toBeLessThan(two * 4)
  expect(space("2026-08-18", "2026-08-18")).toBe(1)
  expect(space("2019-11-05", "2026-08-18")).toBe(5)
})

const dayFelt = (date: string, today: string): Felt => feltOn(date, today)

test("a late row says HOW late, and that is the pill's whole content", () => {
  const fact = (date: string): string | undefined =>
    owedFact(date, true, dayFelt(date, "2026-08-18"))
  expect(fact("2026-08-17")).toBe("1 day late")
  expect(fact("2026-08-15")).toBe("3 days late")
  expect(fact("2019-11-05")).toBe("7 years late")
})

test("a row ahead says nothing, unless it names a TIME", () => {
  const fact = (date: string): string | undefined =>
    owedFact(date, false, dayFelt(date, "2026-08-18"))
  expect(fact("2026-08-24")).toBeUndefined()
  expect(fact("2026-09-08T14:00")).toBe("14:00")
  expect(fact("2026-09-08T14:00:00-04:00")).toBe("14:00")
})

test("lateness is asked of the MARK, never of the date alone", () => {
  expect(owedFact("2026-08-17", false, dayFelt("2026-08-17", "2026-08-18")))
    .toBeUndefined()
})
