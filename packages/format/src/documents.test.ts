import { expect, test } from "bun:test"

import { printAddress } from "./address.ts"
import {
  bytesOf,
  docOf,
  bodiedOf,
  bracketSpacedLinks,
  firstLine,
  isAsset,
  isPicture,
  linksIn,
  pictureOf,
  resolveRelative,
  retargetRelative,
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
test("retargetRelative keeps the same landing when the naming file moves", () => {
  expect(retargetRelative("house.olai", "_olai/Trash.olai", "finishes.md"))
    .toBe("../finishes.md")
  expect(retargetRelative("_olai/Trash.olai", "house.olai", "../finishes.md"))
    .toBe("finishes.md")
  expect(retargetRelative("house.olai", "_olai/Trash.olai", "notes/palette.md"))
    .toBe("../notes/palette.md")
  expect(retargetRelative("notes/plan.olai", "_olai/Trash.olai", "cabinets.md"))
    .toBe("../notes/cabinets.md")
  expect(resolveRelative(
    "_olai/Trash.olai",
    retargetRelative("house.olai", "_olai/Trash.olai", "finishes.md"),
  )).toBe("finishes.md")
})

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
  expect(bodiedOf("Daily/2026/08/2026-08-12.md", "../../../projects/deck.md"))
    .toBe("projects/deck.md")
  expect(bodiedOf("notes/palette.md", "finishes.md")).toBe("notes/finishes.md")
  expect(bodiedOf("notes/palette.md", "./finishes.md")).toBe("notes/finishes.md")
  // A note is written in an OUTLINE, and a link in one resolves the same way.
  expect(bodiedOf("house.olai", "finishes.md")).toBe("finishes.md")
})

// A space in the filename is still a filename. The arithmetic is the same as
// a name without one: join onto the writer, clamp `..`, and a `.md` is a
// document.
test("a relative link to a document whose name has spaces resolves beside the file that names it", () => {
  expect(bodiedOf("Daily/2026/08/2026-08-12.md", "../../../the brief.md"))
    .toBe("the brief.md")
  expect(bodiedOf("notes/palette.md", "the brief.md")).toBe("notes/the brief.md")
  expect(bodiedOf("notes/palette.md", "./the brief.md")).toBe("notes/the brief.md")
  expect(bodiedOf("house.olai", "the brief.md")).toBe("the brief.md")
})

// Markdown's portable spelling of a space in a destination is `%20`. A vault
// that encoded the name is still pointing at the file, not at a file whose
// name contains the percent sign.
test("a percent-encoded space in a document link names the file, not the encoding", () => {
  expect(bodiedOf("notes/palette.md", "the%20brief.md")).toBe("notes/the brief.md")
  expect(bodiedOf("house.olai", "the%20brief.md")).toBe("the brief.md")
  expect(bodiedOf("Daily/2026/08/2026-08-12.md", "../../../the%20brief.md"))
    .toBe("the brief.md")
})

const named = (from: string, prose: string) =>
  linksIn(from, prose).map(printAddress)

// Markdown's portable spelling of a space in a destination is `%20`. The
// scan has to decode it, or the address it prints encodes the percent again.
test("a percent-encoded markdown link to a spaced name is that document", () => {
  expect(named("notes/plan.md", "see [the brief](the%20brief.md)"))
    .toEqual(["notes/the%20brief.md"])
  expect(named("house.olai", "see [the brief](../the%20brief.md)"))
    .toEqual(["the%20brief.md"])
  expect(named("notes/plan.md", "see [scope](the%20brief.md#scope)"))
    .toEqual(["notes/the%20brief.md#scope"])
})

// CommonMark's other spelling: angle brackets around a destination that
// holds a space. Unwrapping them is what makes the space a character of the
// filename rather than the start of a title.
test("an angle-bracketed markdown link to a spaced name is that document", () => {
  expect(named("notes/plan.md", "see [the brief](<the brief.md>)"))
    .toEqual(["notes/the%20brief.md"])
  expect(named("notes/plan.md", "see [scope](<the brief.md#scope>)"))
    .toEqual(["notes/the%20brief.md#scope"])
})

// The space left raw. CommonMark does not allow it inside parentheses, but
// it is the spelling people write, and the scan is what would have to keep
// the space as part of the filename rather than cutting the destination
// there.
test("a raw-space markdown link to a spaced name is that document", () => {
  expect(named("notes/plan.md", "see [the brief](the brief.md)"))
    .toEqual(["notes/the%20brief.md"])
})

// A space that opens a quoted title is still a title, not a filename. The
// scan has to keep dropping it or `[the brief](brief.md "Oak")` would
// start pointing at a file named `brief.md "Oak"`.
test("a markdown link's optional title is not part of the destination", () => {
  expect(named("notes/plan.md", `see [the brief](brief.md "Oak counters")`))
    .toEqual(["notes/brief.md"])
  expect(named("notes/plan.md", `see [the brief](<the brief.md> "Oak counters")`))
    .toEqual(["notes/the%20brief.md"])
})

test("a raw-space destination is wrapped so a CommonMark parser will read it", () => {
  expect(bracketSpacedLinks("see [the brief](the brief.md)"))
    .toBe("see [the brief](<the brief.md>)")
  expect(bracketSpacedLinks(`see [the brief](the brief.md "Oak")`))
    .toBe(`see [the brief](<the brief.md> "Oak")`)
  expect(bracketSpacedLinks("see [the brief](<the brief.md>)"))
    .toBe("see [the brief](<the brief.md>)")
  expect(bracketSpacedLinks("see [the brief](brief.md)")).toBe("see [the brief](brief.md)")
})

// Everything this must not reinterpret. A link with a scheme goes where it
// says, an absolute path is not this app's to resolve, a fragment is the
// platform's, and a relative path to something that has no page is somebody
// pointing at something else.
test("only a relative link to a file with a page is a document link", () => {
  for (const href of [
    "https://example.com/a.md",
    "//example.com/a.md",
    "mailto:someone@example.com",
    "javascript:alert(1)",
    "/finishes.md",
    "#beds",
    "",
    "garden.olai",
    "README",
    "the%ZZ.md",
    "%2Fsecret.md",
  ]) {
    expect(bodiedOf("notes/palette.md", href)).toBeNull()
  }
})

// A PICTURE IS ONE NOW, and it is the one answer here that changed with the
// viewers rather than being added beside them. This rule has always been "a
// file whose content is a BODY", asked of the registry — so the day a picture
// became a kind with a page, a `[shot](art/handle.png)` in somebody's notes
// became a link olai can follow, and the picture's page is what it opens.
// Nothing here widened: the registry did, and this read it.
test("a relative link to a picture, a csv or a pdf is one too", () => {
  expect(bodiedOf("notes/palette.md", "../art/handle.png")).toBe("art/handle.png")
  expect(bodiedOf("notes/palette.md", "sales.csv")).toBe("notes/sales.csv")
  expect(bodiedOf("notes/palette.md", "../q3.pdf")).toBe("q3.pdf")
})

// The suffixes MARKDOWN may name, which is the registry's picture kind minus
// one: `.svg` is a document that can script, so a `![](…)` may not name one
// even though the picture kind claims it and gives it a page. The set's own
// files are not pictures either.
test("only picture extensions are pictures, case-insensitively", () => {
  expect(isPicture("a/shot.png")).toBe(true)
  expect(isPicture("a/SHOT.JPEG")).toBe(true)
  expect(isPicture("a/logo.svg")).toBe(false)
  expect(isPicture("a/plan.olai")).toBe(false)
  expect(isPicture("a/notes.md")).toBe(false)
  expect(isPicture("png")).toBe(false)
})

// The other allowlist, one step wider, and the difference between the two is
// the subject: markdown may name a PICTURE, and the media route may answer
// every file whose page is drawn by POINTING at it, plus the parts a previewed
// page draws itself with. The set's own text files are out of this one because
// they have pages of their own that are handed their content over the wire.
//
// `.svg` is the entry that moved: it is out of markdown's list above and IN
// this one, because a picture's page draws it in an `<img>` fetched from here.
// A `.csv` is the entry that did NOT move — it is a kind with a page, and its
// page reads the text off the wire, so raw bytes over this route would be a
// second way to read a file that already has one.
test("a page, a picture, a pdf and the parts a page draws with are assets", () => {
  expect(isAsset("notes/report.html")).toBe(true)
  expect(isAsset("a/shot.png")).toBe(true)
  expect(isAsset("a/logo.svg")).toBe(true)
  expect(isAsset("a/q3.pdf")).toBe(true)
  expect(isAsset("a/page.CSS")).toBe(true)
  expect(isAsset("a/chart.js")).toBe(true)
  expect(isAsset("a/chart.mjs")).toBe(true)
  expect(isAsset("a/text.woff2")).toBe(true)
  expect(isAsset("a/sales.csv")).toBe(false)
  expect(isAsset("a/notes.md")).toBe(false)
  expect(isAsset("a/plan.olai")).toBe(false)
  expect(isAsset("a/data.json")).toBe(false)
  expect(isAsset("js")).toBe(false)
})

// ── the line a document is named by ────────────────────────────────────
//
// Moved here with the rule itself, from `@olai/web`'s `document/preview.ts`,
// when the agent's `list_documents` wanted the same answer the browser's
// `DocRef` draws.

test("the first line is the first line with anything on it", () => {
  expect(firstLine("\n\n  Brushed brass.\nAnd more.\n")).toBe("Brushed brass.")
})

// A document nearly always opens with its title as a heading, and the hashes
// are markup rather than part of the name.
test("a leading heading is named without its marks", () => {
  expect(firstLine("# Finishes\n\nDoors: matte.")).toBe("Finishes")
  expect(firstLine("### Deep ###")).toBe("Deep")
})

// Only the heading marks. Emphasis, links and code spans stay as written: a
// preview that started interpreting them would be a second, worse renderer.
test("nothing else is interpreted", () => {
  expect(firstLine("- **walnut**, or `birch`")).toBe("- **walnut**, or `birch`")
  expect(firstLine("#tag first")).toBe("#tag first")
})

// A `.md` that opens with a `---` block was called `---` — in the sidebar, in
// the palette and beside every `doc`-carrying row — because the fence was the
// first line with anything on it. The record on top of a document is not what
// the document is CALLED.
test("frontmatter is not the first line", () => {
  expect(firstLine("---\ntitle: The kitchen plan\n---\n\n# The plan\n\nProse.\n"))
    .toBe("The plan")
  // …and when the block is the whole file, the document has nothing to say,
  // which is what makes the caller fall back to the filename.
  expect(firstLine("---\ntitle: x\n---\n")).toBe("")
  // An unclosed `---` is a thematic break and not frontmatter, so the line
  // under it is still the line under it (`./frontmatter.ts` says why).
  expect(firstLine("---\nBrushed brass.\n")).toBe("---")
})

test("an empty document previews as nothing", () => {
  expect(firstLine("")).toBe("")
  expect(firstLine("\n \n")).toBe("")
})

// ── what a document weighs ─────────────────────────────────────────────
//
// UTF-8 bytes, never UTF-16 units. A listing that reported `text.length`
// would agree on every ASCII fixture and drift the moment a body held an
// emoji — which is why the cases below are the ones they are.

test("an empty body weighs nothing", () => {
  expect(bytesOf("")).toBe(0)
})

test("ASCII is one byte per character", () => {
  expect(bytesOf("hello\n")).toBe(6)
})

test("an emoji is four UTF-8 bytes, not two UTF-16 units", () => {
  expect("👋".length).toBe(2)
  expect(bytesOf("👋")).toBe(4)
  expect(bytesOf("hello 👋🔥\n")).not.toBe("hello 👋🔥\n".length)
})
