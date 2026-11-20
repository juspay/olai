import { claims, servingOf } from "./index.ts"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { printAddress } from "./address.ts"
import {
  bytesOf,
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
import { nodesOf } from "./fixtures.testlib.ts"
const nodeOf = (line: string, file: string) => {
  const [located] = nodesOf(`${line}\n`, file)
  if (located === undefined) throw new Error("the fixture parsed to no nodes")
  return located
}

test("a relative path resolves against the naming file's directory", () => {
  expect(resolveRelative("sub/plan.olai", "../notes/a.md")).toBe("notes/a.md")
  expect(resolveRelative("sub/plan.olai", "./a.md")).toBe("sub/a.md")
  expect(resolveRelative("sub/plan.olai", "a.md")).toBe("sub/a.md")
  expect(resolveRelative("plan.olai", "notes/a.md")).toBe("notes/a.md")
})

test("a path climbing above the served directory clamps to it", () => {
  expect(resolveRelative("plan.olai", "../../etc/passwd.md")).toBe("etc/passwd.md")
  expect(resolveRelative("sub/plan.olai", "../../../a.md")).toBe("a.md")
})


test("a relative picture resolves beside the file that names it", () => {
  expect(pictureOf(TEST_CLAIMS, "docs/notes.md", "art/shot.png")).toBe("docs/art/shot.png")
  expect(pictureOf(TEST_CLAIMS, "docs/notes.md", "./shot.png")).toBe("docs/shot.png")
  expect(pictureOf(TEST_CLAIMS, "docs/deep/notes.md", "../art/shot.png")).toBe("docs/art/shot.png")
  expect(pictureOf(TEST_CLAIMS, "notes.md", "../../art/shot.png")).toBe("art/shot.png")
})

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


const named = (from: string, prose: string) =>
  linksIn(TEST_CLAIMS, from, prose).map(printAddress)

test("a percent-encoded markdown link to a spaced name is that document", () => {
  expect(named("notes/plan.md", "see [the brief](the%20brief.md)"))
    .toEqual(["notes/the%20brief.md"])
  expect(named("house.olai", "see [the brief](../the%20brief.md)"))
    .toEqual(["the%20brief.md"])
  expect(named("notes/plan.md", "see [scope](the%20brief.md#scope)"))
    .toEqual(["notes/the%20brief.md#scope"])
})

test("an angle-bracketed markdown link to a spaced name is that document", () => {
  expect(named("notes/plan.md", "see [the brief](<the brief.md>)"))
    .toEqual(["notes/the%20brief.md"])
  expect(named("notes/plan.md", "see [scope](<the brief.md#scope>)"))
    .toEqual(["notes/the%20brief.md#scope"])
})

test("a raw-space markdown link to a spaced name is that document", () => {
  expect(named("notes/plan.md", "see [the brief](the brief.md)"))
    .toEqual(["notes/the%20brief.md"])
})

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
    expect(pathedOf("notes/palette.md", href)).toBeNull()
  }
})

test("a relative link names any served file, not only a body", () => {
  expect(pathedOf("notes/palette.md", "garden.olai")).toBe("notes/garden.olai")
  expect(pathedOf("notes/palette.md", "../garden.olai")).toBe("garden.olai")
  expect(pathedOf("notes/palette.md", "../../README")).toBe("README")
  expect(named("notes/palette.md", "[the garden](garden.olai)"))
    .toEqual(["notes/garden.olai"])
  expect(named("notes/palette.md", "![the handle](../art/handle.png)"))
    .toEqual(["art/handle.png"])
})

test("a relative link to a picture, a csv or a pdf is one too", () => {
  expect(pathedOf("notes/palette.md", "../art/handle.png")).toBe("art/handle.png")
  expect(pathedOf("notes/palette.md", "sales.csv")).toBe("notes/sales.csv")
  expect(pathedOf("notes/palette.md", "../q3.pdf")).toBe("q3.pdf")
})

test("picture references are case-folded within current image claims", () => {
  expect(isPicture(TEST_CLAIMS, "a/shot.png")).toBe(true)
  expect(isPicture(TEST_CLAIMS, "a/SHOT.JPEG")).toBe(true)
  expect(isPicture(TEST_CLAIMS, "a/logo.svg")).toBe(false)
  expect(isPicture(TEST_CLAIMS, "a/plan.olai")).toBe(false)
  expect(isPicture(TEST_CLAIMS, "a/notes.md")).toBe(false)
  expect(isPicture(TEST_CLAIMS, "png")).toBe(false)
})

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

test("the first line is the first line with anything on it", () => {
  expect(firstLine("\n\n  Brushed brass.\nAnd more.\n")).toBe("Brushed brass.")
})

test("a leading heading is named without its marks", () => {
  expect(firstLine("# Finishes\n\nDoors: matte.")).toBe("Finishes")
  expect(firstLine("### Deep ###")).toBe("Deep")
})

test("nothing else is interpreted", () => {
  expect(firstLine("- **walnut**, or `birch`")).toBe("- **walnut**, or `birch`")
  expect(firstLine("#tag first")).toBe("#tag first")
})

test("frontmatter is not the first line", () => {
  expect(firstLine("---\ntitle: The kitchen plan\n---\n\n# The plan\n\nProse.\n"))
    .toBe("The plan")
  expect(firstLine("---\ntitle: x\n---\n")).toBe("")
  expect(firstLine("---\nBrushed brass.\n")).toBe("---")
})

test("an empty document previews as nothing", () => {
  expect(firstLine("")).toBe("")
  expect(firstLine("\n \n")).toBe("")
})

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

test("linksIn reads the prose, never the code", () => {
  expect(named("notes/plan.md", "`[x](missed.md)` `[y](also-missed.md)`\n\n[real](real.md)"))
    .toEqual(["notes/real.md"])
  expect(named("notes/plan.md", "```md\n[x](fenced.md)\n```\n\n[seen](seen.md)")).toEqual(["notes/seen.md"])
})
