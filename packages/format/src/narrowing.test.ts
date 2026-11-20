import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Schema } from "effect"
import { NO_KINDS } from "./typing.ts"

import { addressOf } from "./address.ts"
import { type Agenda, keepingOwed, owedIn } from "./agenda.ts"
import { type DayGroup, datedIn } from "./dates.ts"
import { derive, type Row } from "./derive.ts"
import type { Document, Face } from "./document.ts"
import {
  keeping,
  keepingDated,
  matchedIn,
  matching,
  parseFilter,
  rowsIn,
  type SearchField,
  type Selected,
} from "./filter.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import {
  NarrowingAnswer,
  narrowedIn,
  narrowingOf,
  sameNarrowing,
  showsPutAway,
} from "./narrowing.ts"
import { type PageRequest, type Shown, shownOf } from "./page.ts"
import { pointingOf } from "./pointing.ts"
import type { BrokenFile, OutlineSet } from "./set.ts"
import type { Reading } from "./validate.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
  `{"id":"order","parent":"kitchen","ord":"a0","title":"order the doors","desc":"walnut, or birch","date":"2026-08-10","todo":true}`,
  `{"id":"hinges","parent":"kitchen","ord":"a1","title":"pick the door hinges","done":"2026-08-02"}`,
  `{"id":"herbs-here","parent":"kitchen","ord":"a2","mirror":"herbs"}`,
].join("\n")

const GARDEN = [
  `{"id":"garden","ord":"a0","title":"garden"}`,
  `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed doors","date":"2026-08-01","todo":true}`,
  `{"id":"shed","parent":"garden","ord":"a1","title":"the shed door"}`,
].join("\n")

const TRASH = [
  `{"id":"old","ord":"a0","title":"the old door"}`,
  `{"id":"pulls","parent":"old","ord":"a0","title":"the old pulls"}`,
].join("\n")

const LEFTOVER = `{"id":"attic","ord":"a0","title":"the attic door"}`

const SET = derive(TEST_CLAIMS, nodesOfFiles({
  "house.olai": HOUSE,
  "garden.olai": GARDEN,
  "_olai/Trash.olai": TRASH,
  "Archive.olai": LEFTOVER,
}))

const TODAY = "2026-08-10"

const FILES = ["Archive.olai", "_olai/Trash.olai", "garden.olai", "house.olai"]
const facesOf = (paths: ReadonlyArray<string>): ReadonlyArray<Face> =>
  paths.map((path) => ({ path, title: path, links: [], tags: [] } as unknown as Face))
const FACES = facesOf(FILES)
const READABLE: ReadonlyArray<BrokenFile> = []

const READING: Reading = {
  claims: TEST_CLAIMS,
  set: { documents: FACES, broken: READABLE } as unknown as OutlineSet,
  derived: SET,
  pointing: pointingOf(TEST_CLAIMS, FACES as unknown as ReadonlyArray<Document>),
}

const at = (path: string): PageRequest => ({ kind: "at", address: addressOf(TEST_CLAIMS, path, null)! })
const node = (id: string): PageRequest => ({ kind: "at", address: addressOf(TEST_CLAIMS, "", id)! })

const PAGES: ReadonlyArray<readonly [string, PageRequest]> = [
  ["an outline", at("house.olai")],
  ["another outline", at("garden.olai")],
  ["a zoomed node", node("kitchen")],
  ["a zoom onto an archived node", node("old")],
  ["a leftover archive", at("Archive.olai")],
  ["a day", { kind: "day", date: "2026-08-10" }],
  ["the agenda", { kind: "agenda", today: TODAY }],
  ["the trash", { kind: "trash" }],
]

const QUERIES = ["door", "walnut", "is:done", "is:todo", "is:trashed door", "zzz", "#home"]

const shownAt = (request: PageRequest): Shown => shownOf(READING, request)

const selectedBy = (matches: NarrowingAnswer["matches"]): Selected =>
  new Map(matches.map((one) => [one.id as string, one]))

const oracle = (shows: Shown, text: string): Selected =>
  new Map(
    matching(SET, parseFilter(text, TODAY), { trashed: showsPutAway(TEST_CLAIMS, shows) })
      .map(({ at: found }) => [found.node.id, {}]),
  )

const narrowedPage = (shows: Shown, selected: Selected): unknown => {
  switch (shows.kind) {
    case "outline":
      return { rows: idsOfRows(keeping(shows.rows, selected)), places: rowsIn(shows.rows) }
    case "node":
      return shows.zoomed.kind === "node"
        ? {
          rows: idsOfRows(keeping(shows.zoomed.children, selected)),
          places: rowsIn(shows.zoomed.children),
        }
        : { rows: [], places: 0 }
    case "day":
      return {
        rows: idsOfGroups(keepingDated(shows.groups, selected)),
        places: datedIn(shows.groups),
      }
    case "agenda":
      return {
        rows: idsOfAgenda(keepingOwed(shows.agenda, selected)),
        places: owedIn(shows.agenda),
      }
    case "trash":
      return {
        rows: shows.groups.map((group) => [group.file, idsOfRows(keeping(group.rows, selected))]),
        places: shows.groups.reduce((total, group) => total + rowsIn(group.rows), 0),
      }
    case "document":
    case "broken":
    case "nothing":
      return { rows: [], places: 0 }
  }
}

const matchesOn = (shows: Shown, selected: Selected): number => {
  switch (shows.kind) {
    case "outline":
      return matchedIn(shows.rows, selected)
    case "node":
      return shows.zoomed.kind === "node" ? matchedIn(shows.zoomed.children, selected) : 0
    case "day":
      return datedIn(keepingDated(shows.groups, selected))
    case "agenda":
      return owedIn(keepingOwed(shows.agenda, selected))
    case "trash":
      return shows.groups.reduce(
        (total, group) => total + matchedIn(group.rows, selected),
        0,
      )
    case "document":
    case "broken":
    case "nothing":
      return 0
  }
}

const idsOfRows = (rows: ReadonlyArray<Row>): unknown =>
  rows.map((row) => [row.key, idsOfRows(row.children)])
const idsOfGroups = (groups: ReadonlyArray<DayGroup>): unknown =>
  groups.map((group) => [group.file, group.nodes.map((entry) => entry.shows.node.id)])
const idsOfAgenda = (agenda: Agenda): unknown => [
  agenda.overdue.map((day) => [day.date, idsOfGroups(day.groups)]),
  idsOfGroups(agenda.today),
  agenda.upcoming.map((day) => [day.date, idsOfGroups(day.groups)]),
]

for (const [what, request] of PAGES) {
  for (const text of QUERIES) {
    test(`${what}, filtered by \`${text}\`, is the page the reference matcher leaves`, () => {
      const shows = shownAt(request)
      const mine = selectedBy(narrowedIn(SET, shows, parseFilter(text, TODAY)))
      const theirs = oracle(shows, text)
      expect(narrowedPage(shows, mine)).toEqual(narrowedPage(shows, theirs))
      expect(matchesOn(shows, mine)).toBe(matchesOn(shows, theirs))
    })
  }
}

const idsAt = (request: PageRequest, text: string): ReadonlyArray<string> =>
  narrowedIn(SET, shownAt(request), parseFilter(text, TODAY)).map((one) => one.id as string)

test("a node this page does not draw is not in the answer, however well it matches", () => {
  expect(idsAt(at("house.olai"), "door")).not.toContain("shed")
  expect(idsAt(at("garden.olai"), "door")).toContain("shed")
})

test("a MIRROR is answered by the node it shows, in the file that node lives in", () => {
  expect(idsAt(at("house.olai"), "herb")).toEqual(["herbs"])
})

test("a node drawn twice is answered once", () => {
  const answered = idsAt({ kind: "agenda", today: TODAY }, "herb")
  expect(answered).toEqual(["herbs"])
})

test("what was put away is out of a live page and IN on the trash", () => {
  expect(idsAt(at("house.olai"), "is:trashed door")).toEqual([])
  expect(idsAt({ kind: "trash" }, "door")).toEqual(["old"])
  expect(idsAt(node("old"), "pulls")).toEqual(["pulls"])
})

test("a leftover archive is orphaned from every query, the way it always was", () => {
  expect(idsAt(at("Archive.olai"), "door")).toEqual([])
  expect(idsAt(at("Archive.olai"), "is:trashed door")).toEqual([])
})

test("only what a PRUNE can take away is a candidate", () => {
  expect(idsAt(node("kitchen"), "#home")).toEqual([])
  expect(idsAt(at("house.olai"), "#home")).toEqual(["kitchen"])
})

test("an empty box and a query the grammar refused both select nothing", () => {
  expect(idsAt(at("house.olai"), "   ")).toEqual([])
  expect(idsAt(at("house.olai"), "is:open")).toEqual([])
})

test("the answer carries the words it answers, and survives the wire", () => {
  const answer = narrowingOf(READING, {
    page: at("house.olai"),
    text: "door",
  }, TODAY, NO_KINDS)
  expect(answer.text).toBe("door")
  const encoded = Schema.encodeUnknownSync(NarrowingAnswer)(answer)
  const back = Schema.decodeUnknownSync(NarrowingAnswer)(JSON.parse(JSON.stringify(encoded)))
  expect(back).toEqual(answer)
  expect(sameNarrowing(back, answer)).toBe(true)
})

test("two answers that select the same nodes for the same reasons are the same", () => {
  const ask = (text: string) =>
    narrowingOf(READING, { page: at("house.olai"), text }, TODAY, NO_KINDS)
  expect(sameNarrowing(ask("door"), ask("door"))).toBe(true)
  expect(sameNarrowing(ask("door"), ask("hinges"))).toBe(false)
})

const answerOf = (
  text: string,
  ...matches: ReadonlyArray<readonly [id: string, field?: SearchField]>
): NarrowingAnswer => ({
  text,
  matches: matches.map(([id, field]) => ({
    id: id as NarrowingAnswer["matches"][number]["id"],
    ...(field === undefined ? {} : { matched: field }),
  })),
})

test("an answer that MOVED is never mistaken for the one before it", () => {
  const was = answerOf("door", ["order", "title"], ["hinges", "title"])

  expect(sameNarrowing(was, answerOf("door", ["order", "title"], ["hinges", "title"])))
    .toBe(true)

  expect(sameNarrowing(was, answerOf("door", ["hinges", "title"], ["order", "title"])))
    .toBe(false)

  expect(sameNarrowing(was, answerOf("door", ["order", "title"], ["tiles", "title"])))
    .toBe(false)

  expect(sameNarrowing(was, answerOf("door", ["order", "desc"], ["hinges", "title"])))
    .toBe(false)

  expect(sameNarrowing(was, answerOf("door", ["order"], ["hinges", "title"])))
    .toBe(false)

  expect(sameNarrowing(was, answerOf("door", ["order", "title"]))).toBe(false)

  expect(sameNarrowing(was, answerOf("doors", ["order", "title"], ["hinges", "title"])))
    .toBe(false)
})
