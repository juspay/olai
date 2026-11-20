import { TEST_CLAIMS } from "@olai/format/testlib"
import {
  agendaOf,
  type Agenda,
  type DayGroup,
  datedOn,
  derive,
  nodesOf,
  parseFilter,
  type Row,
  rowsIn,
  rowsOf,
  type Shown,
  withoutDone,
  zoom,
} from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { only } from "@olai/web/client/narrow.ts"
import { type Drawn, drawnBy } from "../page.ts"
import { answered } from "./answered.testlib.ts"
import type { Matches } from "./matches.ts"
import { createNarrowing, type Narrowing } from "./narrowing.ts"

const derived = derive(TEST_CLAIMS, nodesOfFiles({
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":true}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters #home","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-14"}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets"}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges #home","todo":true,"date":"2026-08-14"}`,
  ].join("\n"),
  "_olai/Trash.olai": [
    `{"id":"old-kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    `{"id":"tiles","parent":"old-kitchen","ord":"a0","title":"choose the tiles","todo":true}`,
    `{"id":"grout","parent":"old-kitchen","ord":"a1","title":"pick the grout"}`,
    `{"id":"shims","parent":"old-kitchen","ord":"a2","title":"return the shims","todo":true,"date":"2026-08-14"}`,
  ].join("\n"),
}))

const TODAY = "2026-08-17"

const said = (shows: Shown, text: string, over = derived): Matches =>
  answered(over, shows, text, TODAY)

const narrowing = (shows: Shown, text: string, hideDone = false): Narrowing => {
  const drawn = drawnBy(shows)
  return createRoot(() =>
    createNarrowing({
      query: () => parseFilter(text, TODAY),
      text: () => text,
      all: () => drawn,
      visible: () =>
        hideDone && drawn.kind === "tree"
          ? { kind: "tree", rows: withoutDone(drawn.rows) }
          : drawn,
      matched: () => said(shows, text),
      answering: () => text.trim(),
    })
  )
}

const house: Shown = {
  kind: "outline",
  file: "house.olai",
  rows: rowsOf(derived, "house.olai"),
}
const tree: Drawn = drawnBy(house)
const page = (text: string, hideDone = false): Narrowing =>
  narrowing(house, text, hideDone)

test("an empty box is not a filter, and the page is the page", () => {
  const reading = page("")
  expect(reading.active()).toBe(false)
  expect(treeRows(reading)).toHaveLength(1)
  expect(reading.counts().held).toBe(0)
  expect(reading.counts().shown).toBe(0)
})

test("a filtered page counts the rows it draws, of the rows it holds", () => {
  const reading = page("hinges")
  expect(reading.counts().shown).toBe(1)
  expect(reading.counts().held).toBe(5)
})

test("a query keeps its matches and the ancestors that lead to them", () => {
  const reading = page("hinges")
  expect(reading.active()).toBe(true)
  expect(reading.counts().shown).toBe(1)
  expect(flat(treeRows(reading))).toEqual(["kitchen", "install", "hinges"])
})

test("finished work is hidden before the query is asked, and the difference is reported", () => {
  const showing = page("#home")
  expect(showing.counts().shown).toBe(3)
  expect(showing.counts().hiddenAsDone).toBe(0)

  const hiding = page("#home", true)
  expect(hiding.counts().shown).toBe(2)
  expect(hiding.counts().hiddenAsDone).toBe(1)
})

test("the denominator does not move when finished work is hidden", () => {
  expect(page("#home").counts().held).toBe(5)

  const hiding = page("#home", true)
  expect(hiding.counts()).toEqual({ shown: 2, held: 5, hiddenAsDone: 1 })
  expect(rowsIn(treeRows(hiding))).toBe(4)
})

test("`is:done` under a reader who hides finished work says why it found nothing", () => {
  const hiding = page("is:done", true)
  expect(treeRows(hiding)).toEqual([])
  expect(hiding.counts().shown).toBe(0)
  expect(hiding.counts().hiddenAsDone).toBe(1)
  expect(hiding.counts().held).toBe(5)
})

test("a relative date is counted from the day the page is being read on", () => {
  const reading = page("date:this-month")
  expect(reading.counts().shown).toBe(3)
  expect(flat(treeRows(reading)))
    .toEqual(["kitchen", "demo", "order", "install", "hinges"])
  expect(treeRows(page("date:this-week"))).toEqual([])
})

test("a refused operator empties the page and carries its reason", () => {
  const reading = page("is:open")
  expect(reading.active()).toBe(true)
  expect(treeRows(reading)).toEqual([])
  expect(reading.refusals().map((one) => one.token)).toEqual(["is:open"])
})

const dayOf = (date: string, notes: ReadonlyArray<string> = []): Shown => ({
  kind: "day",
  date,
  groups: datedOn(derived, date),
  notes,
})

test("a day keeps the rows that matched, and drops the outline that has none", () => {
  const whole = dayOf("2026-08-14")
  expect(datedIds(drawnBy(whole))).toEqual(["order", "hinges"])

  const reading = narrowing(whole, "hinges")
  expect(reading.counts().shown).toBe(1)
  expect(reading.counts().held).toBe(2)
  expect(datedIds(reading.drawn())).toEqual(["hinges"])

  const none = narrowing(whole, "bathroom")
  expect(groupsIn(none.drawn())).toEqual([])
  expect(none.counts().shown).toBe(0)
  expect(none.counts().held).toBe(2)
})

test("a day draws no archived row, so no query finds one on it", () => {
  const whole = dayOf("2026-08-14")
  const sought = narrowing(whole, "shims")
  expect(sought.counts().shown).toBe(0)
  expect(datedIds(sought.drawn())).toEqual([])
  expect(narrowing(whole, "is:trashed").counts().shown).toBe(0)
  expect(datedIds(narrowing(whole, "-is:trashed").drawn()))
    .toEqual(["order", "hinges"])
})

test("the agenda answers the same way, over the dates read forward", () => {
  const forward: Shown = { kind: "agenda", date: TODAY, agenda: agendaOf(derived, TODAY) }
  expect(datedIds(drawnBy(forward))).toEqual(["order", "hinges"])

  expect(narrowing(forward, "shims").counts().shown).toBe(0)
  expect(narrowing(forward, "is:trashed").counts().shown).toBe(0)
  expect(datedIds(narrowing(forward, "-is:trashed").drawn()))
    .toEqual(["order", "hinges"])
})

test("an outline draws no archived row, whatever is typed", () => {
  expect(page("shims").counts().shown).toBe(0)
  expect(treeRows(page("shims"))).toEqual([])
})

test("a day's note goes while a filter is on, and comes back when it clears", () => {
  const written = dayOf("2026-08-14", ["Daily/2026-08-14.md"])
  expect(notesIn(narrowing(written, "").drawn())).toEqual(["Daily/2026-08-14.md"])
  expect(notesIn(narrowing(written, "hinges").drawn())).toEqual([])
  expect(notesIn(narrowing(written, "bathroom").drawn())).toEqual([])
})

const agenda: Agenda = agendaOf(derived, TODAY)
const owed: Shown = { kind: "agenda", date: TODAY, agenda }

test("the agenda narrows day by day, and counts every row it draws", () => {
  expect(datedIds(drawnBy(owed))).toEqual(["order", "hinges"])

  const reading = narrowing(owed, "is:todo")
  expect(reading.counts().held).toBe(2)
  expect(reading.counts().shown).toBe(1)
  const drawn = reading.drawn()
  expect(drawn.kind === "agenda" ? drawn.agenda.overdue.length : -1).toBe(1)
  expect(datedIds(drawn)).toEqual(["hinges"])
})

const trash: Shown = {
  kind: "trash",
  files: ["_olai/Trash.olai"],
  groups: [{ file: "_olai/Trash.olai", rows: rowsOf(derived, "_olai/Trash.olai") }],
  records: nodesOf(derived, "_olai/Trash.olai").length,
}

test("a word typed on the trash searches what was put away", () => {
  const reading = narrowing(trash, "grout")
  expect(reading.counts().shown).toBe(1)
  expect(reading.counts().held).toBe(4)
  expect(flat(archiveRows(reading.drawn()))).toEqual(["old-kitchen", "grout"])
})

test("an archive with nothing left is not drawn at all", () => {
  const reading = narrowing(trash, "bathroom")
  expect(archiveRows(reading.drawn())).toEqual([])
  expect(reading.counts().shown).toBe(0)
})

test("`is:trashed` and its negation still say what they say here", () => {
  expect(narrowing(trash, "is:trashed").counts().shown).toBe(4)
  expect(narrowing(trash, "-is:trashed").counts().shown).toBe(0)
})

test("`is:trashed` on an outline still draws that outline's nothing", () => {
  const reading = page("is:trashed")
  expect(treeRows(reading)).toEqual([])
  expect(reading.counts().shown).toBe(0)
})

test("a zoom onto an archived node is searched like the pile it is in", () => {
  const zoomed = zoom(derived, "old-kitchen")
  if (zoomed.kind !== "node") throw new Error(`the archive has no \`old-kitchen\``)
  const inArchive: Shown = { kind: "node", zoomed, backlinks: [] }
  const reading = narrowing(inArchive, "grout")
  expect(flat(treeRows(reading))).toEqual(["grout"])
  expect(reading.counts().shown).toBe(1)
  expect(narrowing(inArchive, "is:trashed").counts().shown).toBe(3)
})

test("a page with nothing to narrow counts nothing and stays itself", () => {
  const reading = narrowing({ kind: "nothing", sought: "outline", requested: null }, "hinges")
  expect(reading.drawn()).toEqual({ kind: "none" })
  expect(reading.counts().shown).toBe(0)
  expect(reading.counts().held).toBe(0)
})

const treeRows = (reading: Narrowing): ReadonlyArray<Row> =>
  only(reading.drawn(), "tree")?.rows ?? []

const archiveRows = (drawn: Drawn): ReadonlyArray<Row> =>
  only(drawn, "trash")?.groups.flatMap((group) => group.rows) ?? []

const notesIn = (drawn: Drawn): ReadonlyArray<string> =>
  only(drawn, "day")?.notes ?? []

const groupsIn = (drawn: Drawn): ReadonlyArray<DayGroup> => {
  const day = only(drawn, "day")
  if (day !== undefined) return day.groups
  const owed = only(drawn, "agenda")?.agenda
  return owed === undefined ? [] : [
    ...owed.overdue.flatMap((gone) => gone.groups),
    ...owed.today,
    ...owed.upcoming.flatMap((ahead) => ahead.groups),
  ]
}

const datedIds = (drawn: Drawn): ReadonlyArray<string> =>
  groupsIn(drawn).flatMap((group) => group.nodes.map((one) => one.shows.node.id))

const flat = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [row.at.node.id, ...flat(row.children)])

const waiting = (
  shows: Shown,
  text: string,
  said: { matched?: Matches; answering: string | null },
): Narrowing =>
  createRoot(() => {
    const drawn = drawnBy(shows)
    return createNarrowing({
      query: () => parseFilter(text, TODAY),
      text: () => text,
      all: () => drawn,
      visible: () => drawn,
      matched: () => said.matched,
      answering: () => said.answering,
    })
  })

test("a filter nothing has answered yet draws the whole page, and says so", () => {
  const reading = waiting(house, "hinges", { answering: null })
  expect(reading.active()).toBe(true)
  expect(reading.selected()).toBe(null)
  expect(flat(treeRows(reading))).toEqual(["kitchen", "demo", "order", "install", "hinges"])
  expect(reading.answering()).toBe(null)
})

test("an answer to the query before still narrows, and the page says it is behind", () => {
  const reading = waiting(house, "hinges more", {
    matched: said(house, "hinges"),
    answering: null,
  })
  expect(flat(treeRows(reading))).toEqual(["kitchen", "install", "hinges"])
  expect(reading.selected()).not.toBe(null)
  expect(reading.answering()).toBe(null)
})

test("a refused query answers itself rather than travelling", () => {
  const reading = waiting(house, "is:open", { answering: null })
  expect(reading.active()).toBe(true)
  expect(reading.selected()).not.toBe(null)
  expect(reading.answering()).toBe("is:open")
  expect(treeRows(reading)).toEqual([])
  expect(reading.refusals().map((one) => one.token)).toEqual(["is:open"])
})

test("a trailing space is the box's, not the question's", () => {
  const reading = waiting(house, "hinges ", {
    matched: said(house, "hinges"),
    answering: "hinges",
  })
  expect(reading.answering()).toBe("hinges")
  expect(flat(treeRows(reading))).toEqual(["kitchen", "install", "hinges"])
})

test("an empty box is answered by the parse, not by the wire", () => {
  const reading = waiting(house, "", { answering: null })
  expect(reading.active()).toBe(false)
  expect(reading.answering()).toBe("")
  expect(rowsIn(treeRows(reading))).toBe(5)
})

const FINISHED = derive(TEST_CLAIMS, nodesOfFiles({
  "_olai/Trash.olai": [
    `{"id":"old-bath","ord":"a0","title":"bathroom #home","done":"2026-08-01"}`,
    `{"id":"taps","parent":"old-bath","ord":"a0","title":"the taps #home","done":"2026-08-02"}`,
  ].join("\n"),
}))

test("hiding finished work does not take the archive out of a zoom's scope", () => {
  const rows = rowsOf(FINISHED, "_olai/Trash.olai")
  const whole: Shown = { kind: "outline", file: "_olai/Trash.olai", rows }
  const reading = createRoot(() =>
    createNarrowing({
      query: () => parseFilter("#home", TODAY),
      text: () => "#home",
      all: () => drawnBy(whole),
      visible: () => ({ kind: "tree", rows: withoutDone(rows) }),
      matched: () => said(whole, "#home", FINISHED),
      answering: () => "#home",
    })
  )
  expect(treeRows(reading)).toEqual([])
  expect(reading.counts().shown).toBe(0)
  expect(reading.counts().hiddenAsDone).toBe(2)
})

const putAwayOnADay = (): DayGroup => {
  const shims = zoom(derived, "shims")
  if (shims.kind !== "node") throw new Error("the fixture's archive lost `shims`")
  return {
    file: "_olai/Trash.olai",
    nodes: [{ ...shims, occasion: "date", date: "2026-08-14" }],
  }
}

test("a day handed an archived row still does not widen the scope", () => {
  const shows: Shown = { kind: "day", date: "2026-08-14", groups: [putAwayOnADay()], notes: [] }
  const reading = narrowing(shows, "shims")
  expect(reading.counts().shown).toBe(0)
  expect(datedIds(reading.drawn())).toEqual([])
  expect(narrowing(shows, "is:trashed").counts().shown).toBe(1)
})

test("the agenda handed one does not either, anywhere on its line", () => {
  const group = putAwayOnADay()
  const stretches: ReadonlyArray<Agenda> = [
    { overdue: [{ date: "2026-08-10", groups: [group] }], today: [], upcoming: [] },
    { overdue: [], today: [group], upcoming: [] },
    { overdue: [], today: [], upcoming: [{ date: "2026-08-14", groups: [group] }] },
  ]
  for (const agenda of stretches) {
    const reading = narrowing({ kind: "agenda", date: TODAY, agenda }, "shims")
    expect(reading.counts().shown).toBe(0)
    expect(datedIds(reading.drawn())).toEqual([])
  }
})
