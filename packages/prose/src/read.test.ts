/**
 * WHAT A TEXT SAYS, read once: every wikilink form the plan lists, the code
 * rule, the tags, the headings, the cut of an address and the plain shortcut.
 * The bounds the parse keeps are `./bounded.test.ts`'s.
 */
import { expect, test } from "bun:test"

import { fixtureRows } from "./corpus.testlib.ts"
import { parse, refusalOf } from "./parse.ts"
import { isPlain } from "./plain.ts"
import { read, readTree, type ReadWikilink } from "./read.ts"

const wikilink = (target: string, fragments: ReadonlyArray<string> = [], alias: string | null = null, embed = false): ReadWikilink =>
  ({ target, fragments, alias, embed })

// ── every form the plan lists (plan.md, section 3) ─────────────────────

test("[[Note]] is a link to the note by that name", () => {
  expect(read("see [[Note]]").wikilinks).toEqual([wikilink("Note")])
})

test("[[folder/Note]] is a link by path", () => {
  expect(read("see [[folder/Note]]").wikilinks).toEqual([wikilink("folder/Note")])
})

test("[[Note.md]] keeps its suffix", () => {
  expect(read("see [[Note.md]]").wikilinks).toEqual([wikilink("Note.md")])
})

test("[[Note|alias]] shows its words, and in a table cell the bar is written escaped", () => {
  expect(read("see [[Note|the note]]").wikilinks).toEqual([wikilink("Note", [], "the note")])
  expect(read("see [[Note|the note]]").words).toBe("see the note")
  const table = read("| Where | Link |\n| --- | --- |\n| here | [[Note\\|the note]] |")
  expect(table.wikilinks).toEqual([wikilink("Note", [], "the note")])
})

test("[[Note#Heading]] names a heading", () => {
  expect(read("see [[Note#Heading]]").wikilinks).toEqual([wikilink("Note", ["Heading"])])
  expect(read("see [[Note#Heading]]").words).toBe("see Note > Heading")
})

test("[[#Heading]] names a heading of the same text", () => {
  expect(read("see [[#Heading]]").wikilinks).toEqual([wikilink("", ["Heading"])])
})

test("[[Note#A#B]] names its headings in order", () => {
  expect(read("see [[Note#A#B]]").wikilinks).toEqual([wikilink("Note", ["A", "B"])])
})

test("[[Note#^block]] keeps the block as its last part", () => {
  expect(read("see [[Note#^block]]").wikilinks).toEqual([wikilink("Note", ["^block"])])
})

test("![[picture.png]] is an embed, and its width or size is its alias", () => {
  expect(read("![[picture.png]]").wikilinks).toEqual([wikilink("picture.png", [], null, true)])
  expect(read("![[picture.png|200]]").wikilinks).toEqual([wikilink("picture.png", [], "200", true)])
  expect(read("![[picture.png|200x100]]").wikilinks).toEqual([wikilink("picture.png", [], "200x100", true)])
})

test("![[Note]] and ![[Note#Heading]] are embeds of a note", () => {
  expect(read("![[Note]] ![[Note#Heading]]").wikilinks).toEqual([
    wikilink("Note", [], null, true),
    wikilink("Note", ["Heading"], null, true),
  ])
})

test("a name with a suffix keeps it: a pdf, a csv, a picture, a page", () => {
  expect(read("[[report.pdf]] [[data.csv]] [[photo.png]] [[page.html]]").wikilinks.map((one) => one.target))
    .toEqual(["report.pdf", "data.csv", "photo.png", "page.html"])
})

test("an outline is named with its suffix, and a row after its `#`", () => {
  expect(read("[[house.olai]] [[house.olai#kitchen]] [[house]]").wikilinks).toEqual([
    wikilink("house.olai"),
    wikilink("house.olai", ["kitchen"]),
    wikilink("house"),
  ])
})

test("a wikilink inside code, or after a backslash, stays text", () => {
  for (const text of ["`[[Note]]`", "```\n[[Note]]\n```", "\\[[Note]]"]) expect(read(text).wikilinks).toEqual([])
})

// ── the one rule for code, and the tags ────────────────────────────────

test("code holds no link, tag, mention or heading", () => {
  const said = read("`#home @alice [x](a.md)`\n\n```\n# not a heading\n#home\n```\n\n    # indented")
  expect(said.tags).toEqual([])
  expect(said.links).toEqual([])
  expect(said.headings).toEqual([])
})

test("tags and mentions are read outside code and outside links, emphasis or not", () => {
  expect(read("kitchen #home and *@alice*, not [#this](a.md) or `#that`").tags.map(String)).toEqual(["#home", "@alice"])
})

test("the end of a piece of markup starts a word: `**sam**@pat` mentions pat, `sam@pat` mentions nobody", () => {
  expect(read("ask **sam**@pat today").tags.map(String)).toEqual(["@pat"])
  expect(read("ask sam@pat today").tags.map(String)).toEqual([])
})

test("an HTML comment holds nothing", () => {
  const said = read("<!-- [x](a.md) [[Note]] #home -->")
  expect([said.links, said.wikilinks, said.tags]).toEqual([[], [], []])
})

// ── headings ───────────────────────────────────────────────────────────

test("a heading's slug is made from the words it draws, and repeats are numbered", () => {
  const said = read("# Notes\n\n## See [[finishes|the finishes]]\n\n## About [[finishes#Doors]]\n\n## [Install](setup.md)\n\n## Notes")
  expect(said.headings.map((one) => one.slug === null ? null : String(one.slug))).toEqual(["notes", "see-the-finishes", "about-finishes--doors", "install", "notes-1"])
})

test("a heading inside a quote or a list item is a heading", () => {
  expect(read("> ## Quoted\n\n- ## Listed").headings.map((one) => one.words)).toEqual(["Quoted", "Listed"])
})

test("a heading of punctuation alone makes no slug", () => {
  expect(read("## !!").headings).toEqual([{ depth: 2, words: "!!", slug: null }])
})

// ── links and pictures ─────────────────────────────────────────────────

test("an address is cut once into its path, query and fragment", () => {
  expect(read("[q](finishes.md?v=1#doors)").links).toEqual([
    { url: "finishes.md?v=1#doors", path: "finishes.md", query: "v=1", fragment: "doors", words: "q", picture: false },
  ])
  expect(read("[a](my file.md)").links.map((one) => one.path)).toEqual(["my file.md"])
})

test("a reference-style link is read through its definition", () => {
  expect(read("see [the brief][ref]\n\n[ref]: brief.md").links.map((one) => [one.path, one.words])).toEqual([["brief.md", "the brief"]])
})

test("a picture is read with its words, in its place among the links", () => {
  expect(read("[a](a.md) ![the handle](art/handle.png) [b](b.md)").links.map((one) => [one.path, one.words, one.picture]))
    .toEqual([["a.md", "a", false], ["art/handle.png", "the handle", true], ["b.md", "b", false]])
  expect(read("[![the handle](art/handle.png)](art.md)").links.map((one) => one.path)).toEqual(["art.md", "art/handle.png"])
})

// ── the first line and the words ───────────────────────────────────────

test("the first line is the words a text's first line draws", () => {
  expect(read("# Finishes\n\nOak.").firstLine).toBe("Finishes")
  expect(read("See [the **brief**](brief.md) now\nand then").firstLine).toBe("See the brief now")
  expect(read("<!-- hidden -->\n\nShown").firstLine).toBe("Shown")
})

// ── the plain shortcut ─────────────────────────────────────────────────

test("a title with no markup reads as its own parse — over every title in the fixture outlines", () => {
  const titles = fixtureRows().filter((row) => row.field === "title" && isPlain(row.text))
  expect(titles.length).toBeGreaterThan(50)
  for (const row of titles) expect([row.from, read(row.text)]).toEqual([row.from, readTree(parse(row.text))])
})

test("a wikilink inside a link's words is the one link the text holds", () => {
  const said = read("[see [[finishes]] here](other.md)")
  expect([said.links, said.wikilinks]).toEqual([[], [wikilink("finishes")]])
  expect(said.words).toBe("[see finishes here](other.md)")
})

test("a parser that runs out of stack and one that fails otherwise are told apart", () => {
  const deep = (): number => deep() + 1
  let overflow: unknown
  try {
    deep()
  } catch (cause) {
    overflow = cause
  }
  expect(refusalOf(overflow)).toEqual({ kind: "depth" })
  const bug = new TypeError("a wikilink token holds no wikilink")
  expect(refusalOf(bug)).toEqual({ kind: "failed", cause: bug })
  expect(refusalOf(new RangeError("Invalid array length"))).toEqual({ kind: "failed", cause: new RangeError("Invalid array length") })
})
