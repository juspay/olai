import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { printAddress } from "./address.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { bytesOf } from "./documents.ts"
import type { OutlineError } from "./errors.ts"
import { type Verdict, verdictOf } from "./verdict.ts"
import { failureOf, outlineOf, recordsOf } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { byPath } from "./paths.ts"
import { apart, assemble, documentAt, markdownIn, outlinePaths } from "./set.ts"

type Decoded = Result.Result<Document, Verdict>
const decoded = (files: Record<string, Decoded>): ReadonlyMap<string, Decoded> =>
  new Map(Object.entries(files))

const outline = (file: string, contents: string): Decoded =>
  Result.succeed(outlineOf(contents, file))

const document = (file: string, text: string): Decoded =>
  Result.succeed(bodiedDocument(TEST_CLAIMS, file, text))

const unreadable = (file: string, contents: string): Decoded =>
  Result.fail(verdictOf(failureOf(contents, file)))

const ids = (nodes: ReadonlyArray<Located>): ReadonlyArray<string> =>
  nodes.map((located) => located.node.id)

const paths = (
  set: { readonly documents: ReadonlyArray<Document> },
): ReadonlyArray<string> => set.documents.map((document) => document.path)

const spelled = (values: ReadonlyArray<string>): ReadonlyArray<string> => [...values]

test("assemble collects every decoded file as the document it is", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "home.olai": outline("home.olai", `{"id":"kitchen","ord":"a","title":"kitchen"}\n`),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "work.olai": outline(
      "work.olai",
      `{"id":"budget","ord":"a","title":"budget"}\n{"id":"m","ord":"b","mirror":"kitchen"}`,
    ),
  }))

  expect(paths(set)).toEqual(["home.olai", "notes/cabinets.md", "work.olai"])
  expect(set.documents.map((one) => one.kind)).toEqual(["outline-olai", "markdown", "outline-olai"])
  expect(outlinePaths(set)).toEqual(["home.olai", "work.olai"])
  expect(spelled(markdownIn(set).map((one) => one.path))).toEqual(["notes/cabinets.md"])
  expect(markdownIn(set).map((one) => one.body)).toEqual(["# Cabinets\n"])
  expect(ids(recordsOf(set))).toEqual(["kitchen", "budget", "m"])
  expect(recordsOf(set).map((located) => `${located.file}:${located.line}`))
    .toEqual(["home.olai:1", "work.olai:1", "work.olai:2"])
})

test("a markdown document carries a face", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "notes/plan.md": document(
      "notes/plan.md",
      [
        "# The plan",
        "",
        "Talk to @alice about #kitchen, then read [the brief](../brief.md#scope).",
        "",
        "## Next steps",
      ].join("\n"),
    ),
    "brief.md": document("brief.md", "# Brief\n\n## Scope\n"),
  }))

  const plan = markdownIn(set).find((one) => one.path === "notes/plan.md")!
  expect(plan.title).toBe("The plan")
  expect(spelled(plan.tags)).toEqual(["@alice", "#kitchen", "#scope"])
  expect(spelled(plan.headings)).toEqual(["the-plan", "next-steps"])
  expect(plan.links.map(printAddress)).toEqual(["brief.md#scope"])
  expect(plan.bytes).toBe(bytesOf(plan.body))
})

test("an outline carries a face read off its records", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "home.olai": outline(
      "home.olai",
      [
        `{"id":"kitchen","ord":"a","title":"kitchen #home","desc":"[document](notes/cabinets.md)"}`,
        `{"id":"sink","ord":"b","title":"sink","see":["kitchen"],"desc":"see [the brief](brief.md)"}`,
        "",
      ].join("\n"),
    ),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "brief.md": document("brief.md", "# Brief\n"),
  }))

  const home = set.documents.find((one) => one.path === "home.olai")!
  expect(home.title).toBe("home")
  expect(spelled(home.tags)).toEqual(["#home"])
  expect(home.links.map(printAddress)).toEqual([
    "notes/cabinets.md",
    "#kitchen",
    "brief.md",
  ])
})

test("hypertext is a face and no body", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "saved.html": Result.succeed(bodiedDocument(TEST_CLAIMS, "saved.html", null)),
  }))
  const saved = set.documents[0]!
  expect(saved.kind).toBe("hypertext")
  expect(paths(set)).toEqual(["saved.html"])
  expect(saved.title).toBe("saved")
  expect(saved.links).toEqual([])
  expect(spelled(saved.tags)).toEqual([])
  expect(markdownIn(set)).toEqual([])
})

test("documents come out in path order, whatever order the map holds", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "zeta.olai": outline("zeta.olai", `{"id":"z","ord":"a","title":"z"}`),
    "notes/zebra.md": document("notes/zebra.md", "z\n"),
    "_olai/Trash.olai": outline("_olai/Trash.olai", `{"id":"arch","ord":"a","title":"arch"}`),
    "notes/apple.md": document("notes/apple.md", "a\n"),
    "middle.olai": outline("middle.olai", `{"id":"mid","ord":"a","title":"mid"}`),
  }))
  expect(paths(set)).toEqual([
    "_olai/Trash.olai",
    "middle.olai",
    "notes/apple.md",
    "notes/zebra.md",
    "zeta.olai",
  ])
  expect(ids(recordsOf(set))).toEqual(["arch", "mid", "z"])
})

test("a directory sorts where descending into it would put it", () => {
  expect(["wing.olai", "wing/kitchen.olai", "wing-annexe.olai"].sort(byPath)).toEqual([
    "wing/kitchen.olai",
    "wing-annexe.olai",
    "wing.olai",
  ])
  expect(["a/b.olai", "a/b/c.olai"].sort(byPath)).toEqual(["a/b/c.olai", "a/b.olai"])
  expect(["b.olai", "A.olai", "a.olai"].sort(byPath)).toEqual(["A.olai", "a.olai", "b.olai"])

  const set = assemble(TEST_CLAIMS, decoded({
    "wing.olai": outline("wing.olai", `{"id":"wing","ord":"a","title":"wing"}`),
    "wing/kitchen.olai": outline(
      "wing/kitchen.olai",
      `{"id":"kitchen","ord":"a","title":"kitchen"}`,
    ),
  }))
  expect(outlinePaths(set)).toEqual(["wing/kitchen.olai", "wing.olai"])
  expect(ids(recordsOf(set))).toEqual(["kitchen", "wing"])
})

test("an outline holding no nodes is still one of the set's documents", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "empty.olai": outline("empty.olai", ``),
    "a.olai": outline("a.olai", `{"id":"a","ord":"a","title":"a"}`),
  }))
  expect(outlinePaths(set)).toEqual(["a.olai", "empty.olai"])
  expect(ids(recordsOf(set))).toEqual(["a"])
})

test("nothing decoded assembles to an empty set", () => {
  expect(assemble(TEST_CLAIMS, decoded({}))).toEqual({ documents: [], broken: [] })
})

test("a file that did not decode keeps its place and carries its errors", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "good.olai": outline("good.olai", `{"id":"a","ord":"a","title":"a"}`),
    "bad.olai": unreadable("bad.olai", `{"id":"b","ord":"a",title:"b"}`),
  }))

  expect(outlinePaths(set)).toEqual(["bad.olai", "good.olai"])
  expect(ids(recordsOf(set))).toEqual(["a"])
  expect(set.broken.map((file) => file.file)).toEqual(["bad.olai"])
  expect(set.broken[0]?.errors.map((error) => `${error.file}:${error.line} ${error.code}`))
    .toEqual(["bad.olai:1 not-json"])
})

test("an unreadable document holds its place with an empty body", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "notes/lost.md": Result.fail(verdictOf([
      { file: "notes/lost.md", line: 0, code: "unreadable-directory", message: "gone" },
    ] as ReadonlyArray<OutlineError>)),
  }))
  const lost = markdownIn(set)[0]!
  expect(paths(set)).toEqual(["notes/lost.md"])
  expect(lost.body).toBe("")
  expect(lost.title).toBe("lost")
  expect(spelled(lost.headings)).toEqual([])
  expect(set.broken.map((file) => file.file)).toEqual(["notes/lost.md"])
})

test("a set taken apart and assembled again is the set it was", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "home.olai": outline(
      "home.olai",
      [
        `{"id":"kitchen","ord":"a","title":"kitchen"}`,
        `{"id":"sink","parent":"kitchen","ord":"a","title":"sink"}`,
        "",
      ].join("\n"),
    ),
    "empty.olai": outline("empty.olai", ""),
    "notes/cabinets.md": document("notes/cabinets.md", "# Cabinets\n"),
    "saved.html": Result.succeed(bodiedDocument(TEST_CLAIMS, "saved.html", null)),
    "bad.olai": unreadable("bad.olai", `{"id":"b","ord":"a",title:"b"}`),
  }))

  expect(assemble(TEST_CLAIMS, apart(set))).toEqual(set)
  expect(recordsOf(assemble(TEST_CLAIMS, apart(set)))[0]).toBe(recordsOf(set)[0])
})

test("the inverse holds for the pair path order exists to settle", () => {
  const set = assemble(TEST_CLAIMS, decoded({
    "wing.olai": outline("wing.olai", `{"id":"wing","ord":"a","title":"wing"}`),
    "wing/kitchen.olai": outline(
      "wing/kitchen.olai",
      `{"id":"kitchen","ord":"a","title":"kitchen"}`,
    ),
    "wing/notes.md": document("wing/notes.md", "n\n"),
  }))
  expect(outlinePaths(set)).toEqual(["wing/kitchen.olai", "wing.olai"])
  expect(assemble(TEST_CLAIMS, apart(set))).toEqual(set)
  expect(outlinePaths(assemble(TEST_CLAIMS, apart(set)))).toEqual(["wing/kitchen.olai", "wing.olai"])
})

test("a file found by search is the file a walk finds", () => {
  const files: Record<string, Decoded> = {}
  for (const path of [
    "wing.olai",
    "wing/kitchen.olai",
    "wing/attic.olai",
    "_olai/Inbox.olai",
    "_olai/Trash.olai",
    "Areas.olai",
    "areas.olai",
    "a.olai",
    "a/b.olai",
    "a/b/c.olai",
    "zzz.olai",
  ]) files[path] = outline(path, `{"id":"${path.replace(/[^a-z]/gi, "")}","ord":"a","title":"t"}`)
  for (const path of ["notes.md", "wing/notes.md", "a/b/notes.md", "art/handle.png"]) {
    files[path] = document(path, "n\n")
  }
  const set = assemble(TEST_CLAIMS, decoded(files))
  const walked = (path: string): Document | undefined =>
    set.documents.find((document) => document.path === path)

  for (
    const path of [
      ...Object.keys(files),
      "",
      "AAAA.olai",
      "zzzz.olai",
      "wing",
      "wing/",
      "wing/kitchen",
      "wing/kitchen.olai/deeper.olai",
      "b.olai",
      "_olai/Pins.olai",
    ]
  ) expect(documentAt(set, path)).toBe(walked(path) as never)
})
