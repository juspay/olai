/**
 * EVERY WAY A WIKILINK IS WRITTEN, read by the parser itself — the fixture
 * the browser scenarios read, line by line, and the forms it does not hold,
 * written out here so the fixture keeps what the scenarios count on.
 */
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { Link, Nodes } from "mdast"

import type { WikilinkNode } from "./obsidian.ts"
import { parse } from "./parse.ts"

/** A wikilink as a test says it: target, fragments, alias, embed. */
type Said = readonly [target: string, fragments: ReadonlyArray<string>, alias: string | null, embed: boolean]

const wikilinksOf = (node: Nodes): ReadonlyArray<WikilinkNode> =>
  node.type === "wikilink" ? [node] : "children" in node ? node.children.flatMap(wikilinksOf) : []

const said = (link: WikilinkNode): Said => [link.target, [...link.fragments], link.alias, link.embed]

/** The wikilinks a text holds, as the parser reads them. */
const read = (text: string): ReadonlyArray<Said> => wikilinksOf(parse(text)).map(said)

const linksOf = (node: Nodes): ReadonlyArray<Link> =>
  node.type === "link" ? [node] : "children" in node ? node.children.flatMap(linksOf) : []

const FIXTURE = join(import.meta.dir, "../../tests/fixtures/wikilinks/every-form.md")

/** What each line of the fixture holds, by line number. */
const EVERY_FORM: ReadonlyMap<number, ReadonlyArray<Said>> = new Map<number, ReadonlyArray<Said>>([
  [5, [["finishes", [], null, false]]],
  [6, [["rooms/Note", [], null, false]]],
  [7, [["finishes.md", [], null, false]]],
  [8, [["finishes", [], "the chosen finishes", false]]],
  [9, [["kitchen-sink", ["Tables"], null, false]]],
  [10, [["kitchen-sink", ["Lists", "Nested"], null, false]]],
  [11, [["", ["Further down"], null, false]]],
  [12, [["finishes", ["^abc123"], null, false]]],
  [13, [["Note", [], null, false]]],
  [14, [["greenhouse", [], null, false]]],
  [15, [["Café", [], null, false]]],
  [16, [["paint colours", [], null, false]]],
  [17, [["handle.png", [], null, true]]],
  [18, [["handle.png", [], "40", true]]],
  [19, [["finishes", [], null, true]]],
  [20, [["report.pdf", [], null, false]]],
  [21, [["house.olai", [], null, false]]],
  [22, [["house.olai", ["kitchen"], null, false]]],
  [23, [["house", [], null, false]]],
  [24, [["nowhere", [], null, false]]],
  [25, []],
  [26, []],
  [30, [["kitchen-sink", [], "the sink table", false]]],
])

test("every line of the fixture reads as the wikilink it writes, and no other", () => {
  const tree = parse(readFileSync(FIXTURE, "utf8"))
  const byLine = new Map<number, Array<Said>>()
  for (const link of wikilinksOf(tree)) {
    const line = link.position?.start.line ?? -1
    byLine.set(line, [...(byLine.get(line) ?? []), said(link)])
  }
  for (const [line, expected] of EVERY_FORM) expect({ line, links: byLine.get(line) ?? [] }).toEqual({ line, links: [...expected] })
  expect([...byLine.keys()].filter((line) => !EVERY_FORM.has(line))).toEqual([])
})

test("a picture embed's width, or width and height, is its alias", () => {
  expect(read("![[handle.png|200]]")).toEqual([["handle.png", [], "200", true]])
  expect(read("![[handle.png|200x100]]")).toEqual([["handle.png", [], "200x100", true]])
})

test("a wikilink shows its words as text, never as Markdown", () => {
  const [link] = wikilinksOf(parse("[[finishes|*not* `code`]]"))
  expect(link?.children).toEqual([{ type: "text", value: "*not* `code`" }])
  const [plain] = wikilinksOf(parse("[[kitchen-sink#Lists#Nested]]"))
  expect(plain?.children).toEqual([{ type: "text", value: "kitchen-sink > Lists > Nested" }])
})

test("code, a comment, an escape and a broken pair hold no wikilink", () => {
  for (const text of [
    "`[[finishes]]`",
    "```\n[[finishes]]\n```",
    "    [[finishes]]",
    "<!-- [[finishes]] -->",
    "\\[[finishes]]",
    "[[finishes",
    "[[]]",
    "[[ ]]",
    "[[#]]",
    "[[fini\nshes]]",
    "[[a]b]]",
    "[[a[b]]",
  ]) expect([text, read(text)]).toEqual([text, []])
})

test("a row's title is read like any text", () => {
  expect(read("kitchen remodel with [[finishes]] #home")).toEqual([["finishes", [], null, false]])
})

test("an address holding a space is one, title and all, and code keeps its text", () => {
  expect(linksOf(parse("see [the brief](the brief.md)")).map((one) => one.url)).toEqual(["the brief.md"])
  expect(linksOf(parse(`see [the brief](the brief.md "Oak")`)).map((one) => [one.url, one.title])).toEqual([["the brief.md", "Oak"]])
  expect(linksOf(parse("see [the brief](<the brief.md>)")).map((one) => one.url)).toEqual(["the brief.md"])
  expect(linksOf(parse("see [the brief](brief.md)")).map((one) => one.url)).toEqual(["brief.md"])
  expect(linksOf(parse("see `[the brief](the brief.md)`"))).toEqual([])
})
