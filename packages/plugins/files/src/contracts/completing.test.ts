import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

const DOCUMENT_EXT = TEST_CLAIMS.byKind.get("markdown")!.exts[0]

import { meantAt } from "./completing.ts"

test("a bare name takes the door's own suffix", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "Foo")).toEqual({ file: "Foo.olai" })
  expect(meantAt(TEST_CLAIMS, "markdown", "Foo")).toEqual({ file: "Foo.md" })
})

test("a path with folders in it keeps them and takes the suffix", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "notes/plan")).toEqual({ file: "notes/plan.olai" })
  expect(meantAt(TEST_CLAIMS, "markdown", "notes/idea")).toEqual({ file: "notes/idea.md" })
})

test("a name already carrying the door's suffix is taken exactly as it is", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "Foo.olai")).toEqual({ file: "Foo.olai" })
  expect(meantAt(TEST_CLAIMS, "outline-olai", "plans/next.olai")).toEqual({ file: "plans/next.olai" })
  expect(meantAt(TEST_CLAIMS, "markdown", "notes/wiring.md")).toEqual({ file: "notes/wiring.md" })
})

test("dots in a name keep their spelling and gain the mint suffix", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "plan v1.2")).toEqual({ file: "plan v1.2.olai" })
  expect(meantAt(TEST_CLAIMS, "outline-olai", "Foo.txt")).toEqual({ file: "Foo.txt.olai" })
  expect(meantAt(TEST_CLAIMS, "markdown", "archive.tar.gz")).toEqual({ file: "archive.tar.gz.md" })
})

test("a name carrying another kind's suffix is refused in the box's own words", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "notes.md")).toEqual({
    refused: "`notes.md` is a document, not an outline — type `notes` to make `notes.olai`.",
  })
  expect(meantAt(TEST_CLAIMS, "markdown", "house.olai")).toEqual({
    refused: "`house.olai` is an outline, not a document — type `house` to make `house.md`.",
  })
})

test("the third kind is named too, in the word a reader is given for it", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "report.html")).toEqual({
    refused: "`report.html` is a page, not an outline — type `report` to make `report.olai`.",
  })
})

test("a name that is only a suffix is refused without advice to type nothing", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", DOCUMENT_EXT)).toEqual({
    refused: "`.md` is a document, not an outline.",
  })
})

test("what was typed is trimmed before any of this", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "  Foo  ")).toEqual({ file: "Foo.olai" })
  expect(meantAt(TEST_CLAIMS, "outline-olai", " notes.md ")).toEqual({
    refused: "`notes.md` is a document, not an outline — type `notes` to make `notes.olai`.",
  })
})

test("a path the ops layer will refuse is completed and passed on all the same", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "../escape")).toEqual({ file: "../escape.olai" })
  expect(meantAt(TEST_CLAIMS, "outline-olai", "/etc/passwd")).toEqual({ file: "/etc/passwd.olai" })
})

test("a last segment that names a place, not a file, is not completed at all", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "..")).toEqual({ file: ".." })
  expect(meantAt(TEST_CLAIMS, "outline-olai", ".")).toEqual({ file: "." })
  expect(meantAt(TEST_CLAIMS, "outline-olai", "foo/..")).toEqual({ file: "foo/.." })
  expect(meantAt(TEST_CLAIMS, "markdown", "foo/.")).toEqual({ file: "foo/." })
  expect(meantAt(TEST_CLAIMS, "outline-olai", "notes/")).toEqual({ file: "notes/" })
  expect(meantAt(TEST_CLAIMS, "markdown", " ..  ")).toEqual({ file: ".." })
})

test("a name that merely ends in a dot is still a name", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "Foo.")).toEqual({ file: "Foo..olai" })
  expect(meantAt(TEST_CLAIMS, "outline-olai", "notes/plan..")).toEqual({ file: "notes/plan...olai" })
})

test("a name that begins with a dot is a file, and takes the suffix", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", ".plan")).toEqual({ file: ".plan.olai" })
  expect(meantAt(TEST_CLAIMS, "markdown", "notes/.scratch")).toEqual({ file: "notes/.scratch.md" })
})

test("an empty box, or one holding only spaces, has asked for nothing", () => {
  expect(meantAt(TEST_CLAIMS, "outline-olai", "")).toBeNull()
  expect(meantAt(TEST_CLAIMS, "markdown", "   ")).toBeNull()
})
