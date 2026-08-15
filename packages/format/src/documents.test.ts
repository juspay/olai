import { expect, test } from "bun:test"

import {
  docOf,
  documentOf,
  isPicture,
  pictureOf,
  resolveRelative,
} from "./documents.ts"
import { nodesOf } from "./fixtures.testlib.ts"

/** The one node of a one-line fixture, located in `file`. */
const nodeOf = (line: string, file: string) => {
  const [located] = nodesOf(`${line}\n`, file)
  if (located === undefined) throw new Error("the fixture parsed to no nodes")
  return located
}

// Pure path arithmetic, no disk — a rule that stat'ed a file would be a second
// reader of the directory, and the validator's whole job is to judge the one
// the store already read.
test("a relative path resolves against the naming file's directory", () => {
  expect(resolveRelative("sub/plan.olai", "../notes/a.md")).toBe("notes/a.md")
  expect(resolveRelative("sub/plan.olai", "./a.md")).toBe("sub/a.md")
  expect(resolveRelative("sub/plan.olai", "a.md")).toBe("sub/a.md")
  expect(resolveRelative("plan.olai", "notes/a.md")).toBe("notes/a.md")
})

// There is nothing above the served directory to name, so a `..` that would
// climb out of it is dropped rather than escaping — every caller then matches
// the answer against files that were actually found, and a path that clamped
// simply resolves to nothing.
test("a path climbing above the served directory clamps to it", () => {
  expect(resolveRelative("plan.olai", "../../etc/passwd.md")).toBe("etc/passwd.md")
  expect(resolveRelative("sub/plan.olai", "../../../a.md")).toBe("a.md")
})

test("docOf is where a node's doc lands, and nothing for a node without one", () => {
  expect(docOf(nodeOf(`{"id":"a","ord":"a","title":"a","doc":"../n/a.md"}`, "sub/p.olai")))
    .toBe("n/a.md")
  expect(docOf(nodeOf(`{"id":"a","ord":"a","title":"a"}`, "p.olai"))).toBeUndefined()
})

// A mirror is a second PLACEMENT of a node, not a second copy of its fields:
// the document belongs to the node it points at, and is drawn from there.
test("a mirror attaches no document of its own", () => {
  expect(docOf(nodeOf(`{"id":"m","ord":"a","mirror":"a"}`, "p.olai"))).toBeUndefined()
})

// A picture is a file beside the text that names it, resolved the same way a
// `doc` is.
test("a relative picture resolves beside the file that names it", () => {
  expect(pictureOf("docs/notes.md", "art/shot.png")).toBe("docs/art/shot.png")
  expect(pictureOf("docs/notes.md", "./shot.png")).toBe("docs/shot.png")
  // Clamped, not escaped: a shared picture folder beside the documents is a
  // real arrangement, and the answer is under the root by construction.
  expect(pictureOf("docs/deep/notes.md", "../art/shot.png")).toBe("docs/art/shot.png")
  expect(pictureOf("notes.md", "../../art/shot.png")).toBe("art/shot.png")
})

// Everything a page must not fetch, and everything it cannot draw. A remote
// image would tell a third party what someone is reading; the rest are ways of
// drawing something that is not a file in this directory.
test("only a relative picture is drawn at all", () => {
  for (const src of [
    "https://example.com/shot.png",
    "http://example.com/shot.png",
    "//example.com/shot.png",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "/etc/shot.png",
    "#anchor",
    "",
    "notes.md",
    "logo.svg",
  ]) {
    expect(pictureOf("docs/notes.md", src)).toBeNull()
  }
})

// A link between two `.md` files is the way a vault of Markdown points at
// itself, and it lands beside the file that WROTE it — the same arithmetic a
// `doc` and a picture already use, which is why they are one resolver.
test("a relative link to a document resolves beside the file that names it", () => {
  expect(documentOf("Daily/2026/08/2026-08-12.md", "../../../projects/deck.md"))
    .toBe("projects/deck.md")
  expect(documentOf("notes/palette.md", "finishes.md")).toBe("notes/finishes.md")
  expect(documentOf("notes/palette.md", "./finishes.md")).toBe("notes/finishes.md")
  // A note is written in an OUTLINE, and a link in one resolves the same way.
  expect(documentOf("house.olai", "finishes.md")).toBe("finishes.md")
})

// Everything this must not reinterpret. A link with a scheme goes where it
// says, an absolute path is not this app's to resolve, a fragment is the
// platform's, and a relative path to something that is not a document is
// somebody pointing at something else.
test("only a relative link to a document is a document link", () => {
  for (const href of [
    "https://example.com/a.md",
    "//example.com/a.md",
    "mailto:someone@example.com",
    "javascript:alert(1)",
    "/finishes.md",
    "#beds",
    "",
    "art/handle.png",
    "garden.olai",
    "README",
  ]) {
    expect(documentOf("notes/palette.md", href)).toBeNull()
  }
})

// A closed allowlist, not "anything that is not an outline": `.svg` is a
// document that can script, and the set's own files are not pictures.
test("only picture extensions are pictures, case-insensitively", () => {
  expect(isPicture("a/shot.png")).toBe(true)
  expect(isPicture("a/SHOT.JPEG")).toBe(true)
  expect(isPicture("a/logo.svg")).toBe(false)
  expect(isPicture("a/plan.olai")).toBe(false)
  expect(isPicture("a/notes.md")).toBe(false)
  expect(isPicture("png")).toBe(false)
})
