/** The one node of a one-line fixture, located in `file`. */

import { claims, servingOf } from "./index.ts"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { printAddress } from "./address.ts"
import {
  bytesOf,
  bodiedOf,
  bracketSpacedLinks,
  firstLine,
  isAsset,
  isPicture,
  linksIn,
  pathedOf,
  pictureOf,
  proseLinks,
  resolveRelative,
} from "./documents.ts"
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


// A picture is a file beside the text that names it, resolved the same way a
// relative prose link is.
test("a relative picture resolves beside the file that names it", () => {
  expect(pictureOf(TEST_CLAIMS, "docs/notes.md", "art/shot.png")).toBe("docs/art/shot.png")
  expect(pictureOf(TEST_CLAIMS, "docs/notes.md", "./shot.png")).toBe("docs/shot.png")
  // Clamped, not escaped: a shared picture folder beside the documents is a
  // real arrangement, and the answer is under the root by construction.
  expect(pictureOf(TEST_CLAIMS, "docs/deep/notes.md", "../art/shot.png")).toBe("docs/art/shot.png")
  expect(pictureOf(TEST_CLAIMS, "notes.md", "../../art/shot.png")).toBe("art/shot.png")
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
    expect(pictureOf(TEST_CLAIMS, "docs/notes.md", src)).toBeNull()
  }
})

// A link between two `.md` files is the way a vault of Markdown points at
// itself, and it lands beside the file that WROTE it — the same arithmetic a
// picture already uses, which is why they are one resolver.
test("a relative link to a document resolves beside the file that names it", () => {
  expect(bodiedOf(TEST_CLAIMS, "Daily/2026/08/2026-08-12.md", "../../../projects/deck.md"))
    .toBe("projects/deck.md")
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "finishes.md")).toBe("notes/finishes.md")
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "./finishes.md")).toBe("notes/finishes.md")
  // A note is written in an OUTLINE, and a link in one resolves the same way.
  expect(bodiedOf(TEST_CLAIMS, "house.olai", "finishes.md")).toBe("finishes.md")
})

// A space in the filename is still a filename. The arithmetic is the same as
// a name without one: join onto the writer, clamp `..`, and a `.md` is a
// document.
test("a relative link to a document whose name has spaces resolves beside the file that names it", () => {
  expect(bodiedOf(TEST_CLAIMS, "Daily/2026/08/2026-08-12.md", "../../../the brief.md"))
    .toBe("the brief.md")
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "the brief.md")).toBe("notes/the brief.md")
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "./the brief.md")).toBe("notes/the brief.md")
  expect(bodiedOf(TEST_CLAIMS, "house.olai", "the brief.md")).toBe("the brief.md")
})

// Markdown's portable spelling of a space in a destination is `%20`. A vault
// that encoded the name is still pointing at the file, not at a file whose
// name contains the percent sign.
test("a percent-encoded space in a document link names the file, not the encoding", () => {
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "the%20brief.md")).toBe("notes/the brief.md")
  expect(bodiedOf(TEST_CLAIMS, "house.olai", "the%20brief.md")).toBe("the brief.md")
  expect(bodiedOf(TEST_CLAIMS, "Daily/2026/08/2026-08-12.md", "../../../the%20brief.md"))
    .toBe("the brief.md")
})

const named = (from: string, prose: string) =>
  linksIn(TEST_CLAIMS, from, prose).map(printAddress)

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
// platform's, and a string that names no path at all is somebody pointing at
// something else.
test("anything else is not a path this app resolves", () => {
  for (const href of [
    "https://example.com/a.md",
    "//example.com/a.md",
    "mailto:someone@example.com",
    "javascript:alert(1)",
    "/finishes.md",
    "#beds",
    "",
    "the%ZZ.md",
    "%2Fsecret.md",
  ]) {
    expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", href)).toBeNull()
  }
})

// THE WIDENING of the link rule, and it is the whole of what changed here: a
// `[…](…)` names whichever served file it resolves to, whatever kind page it
// carries. An outline is a document with a page and a reading of its own; a
// `.pdf` is a body; a picture is a file the picture kind claims. `bodiedOf`
// still keeps its own list — it is the RENDERER's half, asked where the
// directory cannot be — but a link is read by the reader, and the reader
// knows the set gives every file a page.
test("a relative link names any served file, not only a body", () => {
  expect(pathedOf("notes/palette.md", "garden.olai")).toBe("notes/garden.olai")
  expect(pathedOf("notes/palette.md", "../garden.olai")).toBe("garden.olai")
  expect(pathedOf("notes/palette.md", "../../README")).toBe("README")
})

test("bodiedOf refuses a file with no body, where pathedOf does not", () => {
  for (const href of [
    "garden.olai",
    "README",
  ]) {
    expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", href)).toBeNull()
    expect(pathedOf("notes/palette.md", href)).not.toBeNull()
  }
  // …and where the WIDER rule lands: a link names the file whatever kind
  // page it carries, because the set serves every file.
  expect(named("notes/palette.md", "[the garden](garden.olai)"))
    .toEqual(["notes/garden.olai"])
  expect(named("notes/palette.md", "![the handle](../art/handle.png)"))
    .toEqual(["art/handle.png"])
})

// A PICTURE IS ONE NOW, and it is the one answer here that changed with the
// viewers rather than being added beside them. The set serves every file, so
// a `[shot](art/handle.png)` in somebody's notes becomes a link olai can
// follow, and the picture's page is what it opens.
test("a relative link to a picture, a csv or a pdf is one too", () => {
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "../art/handle.png")).toBe("art/handle.png")
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "sales.csv")).toBe("notes/sales.csv")
  expect(bodiedOf(TEST_CLAIMS, "notes/palette.md", "../q3.pdf")).toBe("q3.pdf")
})

// The suffixes MARKDOWN may name, which is the registry's picture kind minus
// one: `.svg` is a document that can script, so a `![](…)` may not name one
// even though the picture kind claims it and gives it a page. The set's own
// files are not pictures either.
test("picture references are case-folded within current image claims", () => {
  expect(isPicture(TEST_CLAIMS, "a/shot.png")).toBe(true)
  expect(isPicture(TEST_CLAIMS, "a/SHOT.JPEG")).toBe(true)
  expect(isPicture(TEST_CLAIMS, "a/logo.svg")).toBe(false)
  expect(isPicture(TEST_CLAIMS, "a/plan.olai")).toBe(false)
  expect(isPicture(TEST_CLAIMS, "a/notes.md")).toBe(false)
  expect(isPicture(TEST_CLAIMS, "png")).toBe(false)
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
  expect(isAsset(TEST_CLAIMS, "notes/report.html")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/shot.png")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/logo.svg")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/q3.pdf")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/page.CSS")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/chart.js")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/chart.mjs")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/text.woff2")).toBe(true)
  expect(isAsset(TEST_CLAIMS, "a/sales.csv")).toBe(false)
  expect(isAsset(TEST_CLAIMS, "a/notes.md")).toBe(false)
  expect(isAsset(TEST_CLAIMS, "a/plan.olai")).toBe(false)
  expect(isAsset(TEST_CLAIMS, "a/data.json")).toBe(false)
  expect(isAsset(TEST_CLAIMS, "js")).toBe(false)
})

// ── the line a document is named by ────────────────────────────────────
//
// Moved here with the rule itself, from `@olai/web`'s `document/preview.ts`,
// when the agent's `markdown_index` wanted the same answer the browser's
// a document listing draws.

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
// the palette and on every document page — because the fence was the
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

test("media admits case-folded picture references only while their claim stands", () => {
  expect(isAsset(TEST_CLAIMS, "art/SHOT.PNG")).toBe(true)
  const withoutPictures = claims([...TEST_CLAIMS.byKind.values()].filter(claim => !claim.picture))
  expect(isAsset(withoutPictures, "art/SHOT.PNG")).toBe(false)
})

test("serving policy follows claim data instead of a suffix or MIME roster", () => {
  const table = claims([
    { kind: "framed", exts: [".preview"], holds: "text", kept: false, fetched: true, noun: "page", article: "a", serving: "sealed-frame" },
    { kind: "drawing", exts: [".drawing"], holds: "bytes", kept: false, fetched: true, noun: "image", article: "an", picture: true, inert: [".drawing"] },
  ])
  expect(servingOf(table, "a.preview")).toEqual({ sealed: true, inert: false })
  expect(servingOf(table, "a.drawing")).toEqual({ sealed: false, inert: true })
  expect(servingOf(table, "a.html")).toEqual({ sealed: false, inert: false })
})

// ── one scanner for prose, shared by the faces and the readings ────────
//
// What a piece of PROSE is, when the question is what it says: the literal
// code is not prose, and neither a link the browser draws as code nor a
// dead-link report may treat it as one. Moved here with the scanner itself,
// from the module it replaced (`prose-links.ts`).

test("code examples contain no prose links but adjacent text does", () => {
  const code = ["`[x](inline.md)`", "``[x](back`tick.md)``", "```md\n[x](fenced.md)\n```", "~~~\n[x](tilde.md)\n~~~", "    [x](indented.md)", "    - [x](indented-list.md)"].join("\n")
  expect(proseLinks(code)).toEqual([])
  expect(proseLinks(`${code}\n[real](real.md)`)).toEqual(["real.md"])
  expect(proseLinks("`unclosed [real](real.md)")).toHaveLength(1)
})

test("list continuation links are prose while code within the list remains literal", () => {
  const text = "- Item\n    [continued](continued.md)\n\n      [code](code.md)\n\nOutside [link](outside.md)"
  expect(proseLinks(text)).toEqual(["continued.md", "outside.md"])
})

test("literal lines in a list fence do not swallow links after its indented closer", () => {
  for (const marker of ["```", "~~~"]) {
    const text = `123. Item\n     ${marker}\n[example](ignored.md)\n- literal list marker\n     ${marker}\n\n[after](after.md)`
    expect(proseLinks(text)).toEqual(["after.md"])
  }
})

// The same scanner, asked at the ADDRESS grain: a link to a real document is
// a reference from its writer, and literal code is not prose.
test("linksIn reads the prose, never the code", () => {
  expect(named("notes/plan.md", "`[x](missed.md)` `[y](also-missed.md)`\n\n[real](real.md)"))
    .toEqual(["notes/real.md"])
  expect(named("notes/plan.md", "```md\n[x](fenced.md)\n```\n\n[seen](seen.md)")).toEqual(["notes/seen.md"])
})
