import { expect, test } from "bun:test"

import { DOCUMENT_EXT } from "@olai/format"

import { meantAt } from "./completing.ts"

// THE BUG THIS IS WRITTEN AGAINST: a person typed `Foo` into `+ New outline`
// and got the wire's paragraph about relative `.olai` paths back. A door knows
// which kind it makes, so the name it was handed is the only half missing.
test("a bare name takes the door's own suffix", () => {
  expect(meantAt("outline", "Foo")).toEqual({ at: "Foo.olai" })
  expect(meantAt("document", "Foo")).toEqual({ at: "Foo.md" })
})

// The FOLDERS are part of the name and not of the suffix: what is typed is a
// path, and only its last few characters were ever in question.
test("a path with folders in it keeps them and takes the suffix", () => {
  expect(meantAt("outline", "notes/plan")).toEqual({ at: "notes/plan.olai" })
  expect(meantAt("document", "notes/idea")).toEqual({ at: "notes/idea.md" })
})

test("a name already carrying the door's suffix is taken exactly as it is", () => {
  expect(meantAt("outline", "Foo.olai")).toEqual({ at: "Foo.olai" })
  expect(meantAt("outline", "plans/next.olai")).toEqual({ at: "plans/next.olai" })
  expect(meantAt("document", "notes/wiring.md")).toEqual({ at: "notes/wiring.md" })
})

// A SUFFIX IS ONE THE REGISTRY CLAIMS, and nothing else is a suffix at all:
// olai's set is `.olai`, `.md` and `.html`, and a dot anywhere else is somebody
// spelling a name (`plan v1.2`, `2026-08-12`). Refusing those, or cutting them
// off, would be this box holding an opinion about a filename it cannot have.
test("a dot the registry does not claim is part of the name", () => {
  expect(meantAt("outline", "plan v1.2")).toEqual({ at: "plan v1.2.olai" })
  expect(meantAt("outline", "Foo.txt")).toEqual({ at: "Foo.txt.olai" })
  expect(meantAt("document", "archive.tar.gz")).toEqual({ at: "archive.tar.gz.md" })
})

// The one refusal the box makes for itself — WHICH DOOR you are at, which is a
// question the ops layer never sees, since what reaches it is one completed
// path. It says which kind the name names, which kind this door makes, and what
// to type instead.
test("a name carrying another kind's suffix is refused in the box's own words", () => {
  expect(meantAt("outline", "notes.md")).toEqual({
    refused: "`notes.md` is a document, not an outline — type `notes` to make `notes.olai`.",
  })
  expect(meantAt("document", "house.olai")).toEqual({
    refused: "`house.olai` is an outline, not a document — type `house` to make `house.md`.",
  })
})

// The third kind has no door of its own — olai shows a `.html` and never
// writes one — so it can only ever be met this way round, and it is still named
// rather than lumped in as "wrong". A PAGE, which is the word the client's
// vocabulary seam already chose for a reader (`./kinds.ts`, and `Nothing.tsx`
// spends the same one).
test("the third kind is named too, in the word a reader is given for it", () => {
  expect(meantAt("outline", "report.html")).toEqual({
    refused: "`report.html` is a page, not an outline — type `report` to make `report.olai`.",
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

// The box trims before it asks, and the completion is what the ops layer is
// handed — so a trailing space cannot make `Foo ` and `Foo` two different files.
test("what was typed is trimmed before any of this", () => {
  expect(meantAt("outline", "  Foo  ")).toEqual({ at: "Foo.olai" })
  expect(meantAt("outline", " notes.md ")).toEqual({
    refused: "`notes.md` is a document, not an outline — type `notes` to make `notes.olai`.",
  })
})

// NOTHING ELSE IS JUDGED HERE. A path that climbs out of the directory, or one
// the set already holds, is `create_outline`'s sentence to say — completed
// first, so what the refusal names is the file that was actually asked for.
test("a path the ops layer will refuse is completed and passed on all the same", () => {
  expect(meantAt("outline", "../escape")).toEqual({ at: "../escape.olai" })
  expect(meantAt("outline", "/etc/passwd")).toEqual({ at: "/etc/passwd.olai" })
})
