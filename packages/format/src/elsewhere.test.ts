/**
 * HOW MUCH OF A QUERY A PAGE IS NOT SHOWING — and the three pages the shipped
 * version of #334 got wrong.
 *
 * The first version subtracted two numbers taken from two different questions:
 * a scopeless directory total, minus the size of the page's own narrowing. That
 * is the complement only where the page's matches are a SUBSET of the
 * directory's, and each case below is a page where they are not — one of them
 * (the trash) disjoint, so the arithmetic did not merely mislabel the number, it
 * produced the wrong one and then clamped it to zero, which took the line off
 * the bar entirely.
 *
 * So every claim here is the same claim at a different scope: **the number is
 * the count of matches this page does not draw.**
 */

import { expect, test } from "bun:test"

import { addressOf } from "./address.ts"
import { derive } from "./derive.ts"
import type { Document } from "./document.ts"
import { elsewhereOf } from "./elsewhere.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import { fileKind } from "./kinds.ts"
import type { PageRequest } from "./page.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel #next"}`,
  `{"id":"install","parent":"kitchen","ord":"a0","title":"install them"}`,
  `{"id":"cabinets","parent":"install","ord":"a0","title":"order the cabinets #next"}`,
  `{"id":"shed","ord":"a1","title":"the shed #next"}`,
].join("\n")
const GARDEN = [
  `{"id":"garden","ord":"a0","title":"garden"}`,
  `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed #next"}`,
].join("\n")
const TRASH = [
  `{"id":"old","ord":"a0","title":"an old #next thing"}`,
  `{"id":"older","ord":"a1","title":"an older #next thing"}`,
].join("\n")

const SET = derive(nodesOfFiles({
  "_olai/Trash.olai": TRASH,
  "garden.olai": GARDEN,
  "house.olai": HOUSE,
}))

const TODAY = "2026-08-10"

const documentsOf = (
  paths: ReadonlyArray<string>,
  bodies: Readonly<Record<string, string>> = {},
): ReadonlyArray<Document> =>
  paths.map((path) =>
    ({
      // The REGISTRY decides which kind a path is, never a suffix spelled here.
      kind: fileKind(path) === "outline" ? "outline" : "document",
      path,
      title: path,
      links: [],
      tags: [],
      props: {},
      body: bodies[path] ?? "",
      headings: [],
    }) as unknown as Document
  )

const FILES = ["_olai/Trash.olai", "garden.olai", "house.olai"]

const more = (
  page: PageRequest,
  text = "#next",
  documents = documentsOf(FILES),
): number => elsewhereOf(SET, documents, [], { page, text }, TODAY).more

const at = (path: string): PageRequest => ({
  kind: "at",
  address: addressOf(path, null)!,
})
const node = (id: string): PageRequest => ({ kind: "at", address: addressOf("", id)! })

// The honest case, and the one the shipped subtraction also got right: a whole
// outline draws three of the four live matches, so one is elsewhere.
test("a full outline is missing what the other files hold", () => {
  expect(more(at("house.olai"))).toBe(1)
  expect(more(at("garden.olai"))).toBe(3)
})

// A ZOOM. `kitchen` holds two of house.olai's three matches; the third
// (`shed`) is in the SAME FILE, outside the subtree. The shipped version
// counted it and then called it "in other files".
test("a zoom counts the matches its own file holds outside the subtree", () => {
  // house.olai has kitchen + cabinets + shed; garden has herbs. Zoomed on
  // `kitchen`, the page draws kitchen and cabinets, so `shed` and `herbs` are
  // the two it is not showing.
  expect(more(node("kitchen"))).toBe(2)
})

// THE TRASH, and this is the case that was WRONG rather than misworded. The
// page's rows are archived; a directory-wide search leaves archived nodes out
// unless the query says `is:trashed`, so the two sets were disjoint:
// `max(0, 4 live − 2 archived) = 2` was the old answer where the truth is 4,
// and a bigger archive drove it to 0 and took the line off the bar.
test("the trash counts the live matches it is not showing, not the difference", () => {
  expect(more({ kind: "trash" })).toBe(4)
})

// …and read the other way: standing on a live outline, the archive is not
// "elsewhere", because a directory search does not reach it either. The page
// and the corpus are asked under ONE archive rule, which is the page's.
test("an archived match is not elsewhere from a page that could never show it", () => {
  // house.olai draws 3 of the 4 live matches; `herbs` is the only one missing.
  // The two archived ones are out of both readings.
  expect(more(at("house.olai"))).toBe(1)
  // …and `is:trashed` is how you ask, at which point the page's own rule
  // changes and the archive is in scope for both sides.
  expect(more(at("house.olai"), "is:trashed #next")).toBe(2)
})

// A DAY draws rows from several files already, so "another file" was never the
// frame — what the sentence has to be true about is what the page is not
// showing. Nothing here is dated, so the day draws nothing and every match is
// elsewhere.
test("a day counts every match it is not drawing, whatever file it is in", () => {
  expect(more({ kind: "day", date: TODAY })).toBe(4)
  expect(more({ kind: "agenda", today: TODAY })).toBe(4)
})

// Documents are always elsewhere: a filter selects nodes, and the one page made
// of prose is the one page with no box.
test("a matched document is elsewhere from every page", () => {
  const documents = documentsOf(
    [...FILES, "notes/plan.md"],
    { "notes/plan.md": "a line about #next" },
  )
  expect(more(at("house.olai"), "#next", documents)).toBe(2)
})

// An empty box and a refused query are answered by the parse, so nothing is
// counted and nothing is asked.
test("an empty box and a refused query count nothing", () => {
  expect(more(at("house.olai"), "")).toBe(0)
  expect(more(at("house.olai"), "is:open")).toBe(0)
})
