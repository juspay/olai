import { expect, test } from "bun:test"

import { DOCUMENT_EXT } from "@olai/format"

import { meantAt } from "./completing.ts"

// THE BUG THIS IS WRITTEN AGAINST: a person typed `Foo` into `+ New outline`
// and got the wire's paragraph about relative `.org` paths back. A door knows
// which kind it makes, so the name it was handed is the only half missing.
test("a bare name takes the door's own suffix", () => {
  expect(meantAt("outline", "Foo")).toEqual({ file: "Foo.org" })
  expect(meantAt("document", "Foo")).toEqual({ file: "Foo.md" })
})

// The FOLDERS are part of the name and not of the suffix: what is typed is a
// path, and only its last few characters were ever in question.
test("a path with folders in it keeps them and takes the suffix", () => {
  expect(meantAt("outline", "notes/plan")).toEqual({ file: "notes/plan.org" })
  expect(meantAt("document", "notes/idea")).toEqual({ file: "notes/idea.md" })
})

test("a name already carrying the door's suffix is taken exactly as it is", () => {
  expect(meantAt("outline", "Foo.org")).toEqual({ file: "Foo.org" })
  expect(meantAt("outline", "plans/next.org")).toEqual({ file: "plans/next.org" })
  expect(meantAt("document", "notes/wiring.md")).toEqual({ file: "notes/wiring.md" })
})

// A SUFFIX IS ONE THE REGISTRY CLAIMS, and nothing else is a suffix at all:
// olai's set is `.org`, `.md` and `.html`, and a dot anywhere else is somebody
// spelling a name (`plan v1.2`, `2026-08-12`). Refusing those, or cutting them
// off, would be this box holding an opinion about a filename it cannot have.
test("a dot the registry does not claim is part of the name", () => {
  expect(meantAt("outline", "plan v1.2")).toEqual({ file: "plan v1.2.org" })
  expect(meantAt("outline", "Foo.txt")).toEqual({ file: "Foo.txt.org" })
  expect(meantAt("document", "archive.tar.gz")).toEqual({ file: "archive.tar.gz.md" })
})

// The one refusal the box makes for itself — WHICH DOOR you are at, which is a
// question the ops layer never sees, since what reaches it is one completed
// path. It says which kind the name names, which kind this door makes, and what
// to type instead.
test("a name carrying another kind's suffix is refused in the box's own words", () => {
  expect(meantAt("outline", "notes.md")).toEqual({
    refused: "`notes.md` is a document, not an outline — type `notes` to make `notes.org`.",
  })
  expect(meantAt("document", "house.org")).toEqual({
    refused: "`house.org` is an outline, not a document — type `house` to make `house.md`.",
  })
})

// The third kind has no door of its own — olai shows a `.html` and never
// writes one — so it can only ever be met this way round, and it is still named
// rather than lumped in as "wrong". A PAGE, which is the word the client's
// vocabulary seam already chose for a reader (`./kinds.ts`, and `Nothing.tsx`
// spends the same one).
test("the third kind is named too, in the word a reader is given for it", () => {
  expect(meantAt("outline", "report.html")).toEqual({
    refused: "`report.html` is a page, not an outline — type `report` to make `report.org`.",
  })
})

// The advice half is dropped rather than printed empty: a name that is nothing
// but a suffix leaves nothing to suggest typing. The suffix comes from the
// registry rather than being spelled here, which is the repository's own rule
// about who may write one out (`@olai/tests`' `kinds.test.ts`).
test("a name that is only a suffix is refused without advice to type nothing", () => {
  expect(meantAt("outline", DOCUMENT_EXT)).toEqual({
    refused: "`.md` is a document, not an outline.",
  })
})

// The trim is the RULE's, not the box's — one reading of what is in the box,
// so a trailing space cannot make `Foo ` and `Foo` two different files.
test("what was typed is trimmed before any of this", () => {
  expect(meantAt("outline", "  Foo  ")).toEqual({ file: "Foo.org" })
  expect(meantAt("outline", " notes.md ")).toEqual({
    refused: "`notes.md` is a document, not an outline — type `notes` to make `notes.org`.",
  })
})

// NOTHING ELSE IS JUDGED HERE. A path that climbs out of the directory, or one
// the set already holds, is `create_outline`'s sentence to say — completed
// first, so what the refusal names is the file that was actually asked for.
test("a path the ops layer will refuse is completed and passed on all the same", () => {
  expect(meantAt("outline", "../escape")).toEqual({ file: "../escape.org" })
  expect(meantAt("outline", "/etc/passwd")).toEqual({ file: "/etc/passwd.org" })
})

// ...EXCEPT where completing would erase the refusal itself. Every registered
// suffix begins with a dot, so `..` glued to `.org` is `...org` — an
// ordinary filename the planner accepts, where before it said "no `..`". These
// go to the wire as they were typed, so the paragraph goes on answering for
// them and names what the person actually wrote.
test("a last segment that names a place, not a file, is not completed at all", () => {
  expect(meantAt("outline", "..")).toEqual({ file: ".." })
  expect(meantAt("outline", ".")).toEqual({ file: "." })
  expect(meantAt("outline", "foo/..")).toEqual({ file: "foo/.." })
  expect(meantAt("document", "foo/.")).toEqual({ file: "foo/." })
  // A trailing separator is the same case: the person typed a FOLDER, and
  // `notes/.org` is a hidden file the planner would have taken.
  expect(meantAt("outline", "notes/")).toEqual({ file: "notes/" })
  expect(meantAt("document", " ..  ")).toEqual({ file: ".." })
})

// A TRAILING DOT is a name, and is completed like any other — the same reading
// `plan v1.2` gets. `Foo.` names a file, oddly; `..` names a place, and that
// is the whole of the difference.
test("a name that merely ends in a dot is still a name", () => {
  expect(meantAt("outline", "Foo.")).toEqual({ file: "Foo..org" })
  expect(meantAt("outline", "notes/plan..")).toEqual({ file: "notes/plan...org" })
})

// And a name that BEGINS with a dot is an ordinary hidden file: the store
// prunes dot-DIRECTORIES, not dot-files, so this is a file the sidebar lists.
test("a name that begins with a dot is a file, and takes the suffix", () => {
  expect(meantAt("outline", ".plan")).toEqual({ file: ".plan.org" })
  expect(meantAt("document", "notes/.scratch")).toEqual({ file: "notes/.scratch.md" })
})

// TOTAL OVER ANY TEXT A BOX HOLDS. An empty box is not a refusal and not a
// file: it is a person who has not typed anything, which the box used to decide
// for itself in a second `trim()` beside this one.
test("an empty box, or one holding only spaces, has asked for nothing", () => {
  expect(meantAt("outline", "")).toBeNull()
  expect(meantAt("document", "   ")).toBeNull()
})
