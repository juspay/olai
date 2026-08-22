/**
 * `/search?q=…`, as a reading — the claims the page in front of a reader rests
 * on.
 *
 * Four kinds of claim, and they are different in kind:
 *
 *   - **it is the FILTER, widened**, which is the whole design: the same
 *     `keeping` prune every narrowed page uses, so a match keeps its subtree
 *     and a row that did not match survives only as the ancestry that leads to
 *     one. Asserted against `keeping` itself rather than against a written-out
 *     tree, which is this package's oracle rule wherever one answer has two
 *     producers;
 *   - **the archive rule is the matcher's**, unchanged: what was put away is
 *     out unless the query says `is:trashed`, at this door exactly as at every
 *     other one;
 *   - **the cap says so**, which is the one place a number here is a promise: a
 *     query over the limit draws the limit and reports the uncapped total, so a
 *     bar can say `200 of 1340` rather than drawing 200 rows as the answer;
 *   - **documents are hits**, out of their own half of the set — and a scoped
 *     query's rule that they are not is a fact about scopes rather than about
 *     this page.
 */

import { expect, test } from "bun:test"

import { derive, rowsOf } from "./derive.ts"
import type { Document } from "./document.ts"
import { EVERYWHERE_LIMIT, EVERYWHERE_ROWS, everywhereOf } from "./everywhere.ts"
import { keeping, matching, parseFilter } from "./filter.ts"
import { fileKind } from "./kinds.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel #next"}`,
  `{"id":"install","parent":"kitchen","ord":"a0","title":"install them","todo":true}`,
  `{"id":"cabinets","parent":"install","ord":"a0","title":"order the cabinets #next"}`,
].join("\n")
const GARDEN = [
  `{"id":"garden","ord":"a0","title":"garden"}`,
  `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed #next","todo":true}`,
].join("\n")
const SHED = [
  `{"id":"shed","ord":"a0","title":"shed"}`,
  `{"id":"paint","parent":"shed","ord":"a0","title":"paint it"}`,
].join("\n")
const TRASH = [
  `{"id":"old","ord":"a0","title":"an old #next thing"}`,
].join("\n")

const SET = derive(nodesOfFiles({
  "garden.olai": GARDEN,
  "house.olai": HOUSE,
  "shed.olai": SHED,
  "_olai/Trash.olai": TRASH,
}))

/** Fixed, because a reading that read a clock would be a reading whose tests
 *  expire. */
const TODAY = "2026-08-10"

/** The served directory, as the documents a caller hands this reading. The
 *  outlines carry nothing this page reads but their path; the two `.md`s are
 *  the other half of the answer. */
const documentsOf = (
  paths: ReadonlyArray<string>,
  bodies: Readonly<Record<string, string>> = {},
): ReadonlyArray<Document> =>
  paths.map((path) =>
    ({
      // The REGISTRY decides which kind a path is, never a suffix spelled here
      // (`./kinds.ts` is the one place that reading lives).
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

const FILES = ["_olai/Trash.olai", "garden.olai", "house.olai", "shed.olai"]
const DOCUMENTS = documentsOf(FILES)

const found = (text: string, documents = DOCUMENTS) =>
  everywhereOf(SET, documents, text, TODAY)

/** Which files the answer drew, and which node ids each group's rows show —
 *  the shape a reader would describe the page with. */
const shapeOf = (answer: ReturnType<typeof found>) =>
  answer.groups.map((group) => [group.file, ids(group.rows)] as const)

const ids = (rows: ReturnType<typeof rowsOf>): ReadonlyArray<unknown> =>
  rows.map((row) => [row.at.node.id, ids(row.children)])

test("a tag written in three files is one page, grouped by file, in path order", () => {
  expect(shapeOf(found("#next"))).toEqual([
    ["garden.olai", [["garden", [["herbs", []]]]]],
    ["house.olai", [["kitchen", [["install", [["cabinets", []]]]]]]],
  ])
  // Three nodes matched; `shed.olai` holds none and is not a heading over
  // nothing.
  expect(found("#next").matches).toBe(3)
  expect(found("#next").drawn).toBe(3)
})

test("a match keeps its ancestry and its subtree — it IS `keeping`, widened", () => {
  // The oracle: this page is the filter's own prune, run over every outline
  // rather than over the one in front of somebody. A tree written out here
  // would be a second opinion about what `keeping` does.
  const filter = parseFilter("install", TODAY)
  const selected = new Set(matching(SET, filter).map((one) => one.at.node.id))
  expect(found("install").groups).toEqual([
    { file: "house.olai", rows: keeping(rowsOf(SET, "house.olai"), selected) },
  ])
  // ...and what that prune keeps, said in the shape a reader sees: the ANCESTOR
  // that leads to the match, and the whole subtree under it.
  expect(shapeOf(found("install"))).toEqual([
    ["house.olai", [["kitchen", [["install", [["cabinets", []]]]]]]],
  ])
})

test("an empty box and a refused query find nothing, and neither is an error", () => {
  for (const text of ["", "   ", `is:open`, `"unclosed`]) {
    const answer = found(text)
    expect(answer.groups).toEqual([])
    expect(answer.documents).toEqual([])
    expect(answer.matches).toBe(0)
    expect(answer.text).toBe(text)
  }
})

test("what was put away is out unless the query says so", () => {
  expect(shapeOf(found("#next")).map(([file]) => file))
    .not.toContain("_olai/Trash.olai")
  expect(shapeOf(found("is:trashed #next"))).toEqual([
    ["_olai/Trash.olai", [["old", []]]],
  ])
})

test("the cap draws its limit and reports the whole number", () => {
  const many = Object.fromEntries(
    Array.from({ length: 3 }, (_, file) => [
      `many-${file}.olai`,
      Array.from(
        { length: EVERYWHERE_LIMIT },
        (_, index) => `{"id":"n${file}-${index}","ord":"a${index}","title":"widget ${index}"}`,
      ).join("\n"),
    ]),
  )
  const set = derive(nodesOfFiles(many))
  const answer = everywhereOf(set, documentsOf(Object.keys(many)), "widget", TODAY)
  expect(answer.matches).toBe(EVERYWHERE_LIMIT * 3)
  expect(answer.drawn).toBe(EVERYWHERE_LIMIT)
  // WHOLE FILES rather than a sample of each: the cap is applied in the set's
  // own file-then-line order, so what is dropped is the tail of the directory.
  expect(answer.groups.map((group) => group.file)).toEqual(["many-0.olai"])
})

test("documents are hits here, found by their prose as well as by their name", () => {
  const documents = documentsOf(
    [...FILES, "notes/cabinets.md", "notes/other.md"],
    { "notes/other.md": "a line about the herb bed" },
  )
  expect(found("cabinets", documents).documents.map((one) => String(one.at.path)))
    .toEqual(["notes/cabinets.md"])
  expect(found("herb bed", documents).documents.map((one) => String(one.at.path)))
    .toEqual(["notes/other.md"])
  // WHY it is here rides with it, on the format's own rule for absence: a field
  // carried the words, and a query naming none says nothing.
  expect(found("herb bed", documents).documents[0]?.matched).toBe("body")
  expect(found("is:done", documents).documents).toEqual([])
})

// ── the two bounds, and the files never opened ────────────────────────

test("a file that holds no match is never a group, and a mirror of one is not a row", () => {
  // `herbs` matches in garden.olai; house.olai draws a MIRROR of it. The node
  // is already on this page in the file it lives in, so a placement of it
  // elsewhere would be the same node twice — which is why `matching` answers
  // with no mirrors either.
  const set = derive(nodesOfFiles({
    "garden.olai": [
      `{"id":"garden","ord":"a0","title":"garden"}`,
      `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed"}`,
    ].join("\n"),
    "house.olai": [
      `{"id":"kitchen","ord":"a0","title":"kitchen"}`,
      `{"id":"here","parent":"kitchen","ord":"a0","mirror":"herbs"}`,
    ].join("\n"),
  }))
  const answer = everywhereOf(set, documentsOf(["garden.olai", "house.olai"]), "herb", TODAY)
  expect(answer.groups.map((group) => group.file)).toEqual(["garden.olai"])
  expect(answer.matches).toBe(1)
  expect(answer.drawn).toBe(1)
})

// The second bound, and the reason there is one: a match keeps its whole
// subtree, so a cap on MATCHES is no bound at all on rows. A single hit on a
// file's root would otherwise put every node of that file on the wire.
test("the row bound stops the page after the file that filled it, and says so", () => {
  const wide = (file: string, howMany: number) =>
    [
      `{"id":"${file}-root","ord":"a0","title":"the ${file} pile is deep"}`,
      ...Array.from(
        { length: howMany },
        (_unused, index) =>
          `{"id":"${file}-${index}","parent":"${file}-root","ord":"a${
            String(index).padStart(4, "0")
          }","title":"leaf ${index}"}`,
      ),
    ].join("\n")
  // Two files, each one match (the root's title) bringing a subtree past the
  // budget with it.
  const set = derive(nodesOfFiles({
    "a.olai": wide("a", EVERYWHERE_ROWS),
    "b.olai": wide("b", EVERYWHERE_ROWS),
  }))
  const answer = everywhereOf(set, documentsOf(["a.olai", "b.olai"]), "pile is deep", TODAY)
  // BOTH matched — the uncapped number is never cut, which is what makes the
  // bound sayable — and only the first file is drawn.
  expect(answer.matches).toBe(2)
  expect(answer.drawn).toBe(1)
  expect(answer.groups.map((group) => group.file)).toEqual(["a.olai"])
})

// …and WHY each drawn row is drawn, carried on the answer rather than asked for
// beside it: a narrowing of this page would be this whole reading run a second
// time (the module header argues it).
test("the answer says which of its rows matched, and why", () => {
  const answer = found("#next")
  expect([...answer.matched].map((one) => [String(one.id), one.matched]))
    .toEqual([["herbs", "title"], ["kitchen", "title"], ["cabinets", "title"]])
  // A row kept only as ancestry is not in it — that is exactly the distinction
  // the page's dim is drawn from.
  expect(answer.matched.map((one) => String(one.id))).not.toContain("garden")
})
