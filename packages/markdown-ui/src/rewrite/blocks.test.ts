/**
 * A FENCE IN A LANGUAGE SOMEBODY CLAIMED is a placeholder holding its text,
 * and nothing more passes the sanitiser for it.
 *
 * The claim is the caller's: a set of languages handed to the render, which
 * only the document page fills (from `document.block`, `olai-plugin-markdown`).
 * What is pinned here is the HTML that arrives at `innerHTML` before anything
 * is mounted into it: the fence's text, escaped, in an element of ours made
 * after the sanitiser has run — and every other fence drawn exactly as before.
 */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import type { Element, Root } from "hast"

import { installPipeline } from "../chunk.ts"
import * as pipeline from "../pipeline.ts"
import { renderLineLanding, renderMarkdown, renderToTree } from "../render.ts"

installPipeline(pipeline)

const NOTE = "notes.md"
const READER: ReadonlySet<string> = new Set(["reader"])
const fenced = (language: string, text: string): string => `Before.\n\n\`\`\`${language}\n${text}\n\`\`\`\n\nAfter.\n`

/** Every element of a tree, in document order. */
const elements = (tree: Root | Element): ReadonlyArray<Element> =>
  tree.children.flatMap((child) => child.type === "element" ? [child, ...elements(child)] : [])

/** The text under an element, as a page would read it. */
const textOf = (element: Element): string =>
  element.children.map((child) => child.type === "text" ? child.value : child.type === "element" ? textOf(child) : "").join("")

const HOSTILE = `la <b>maison</b> & <script>alert(1)</script> [[maison]] | the house`

test("a fence in a claimed language is a placeholder holding the fence's text", () => {
  const tree = renderToTree(undefined, fenced("reader", HOSTILE), NOTE, "block", undefined, READER)
  const placeholders = elements(tree).filter((one) => one.properties["dataOlaiBlock"] !== undefined)
  expect(placeholders.map((one) => [one.tagName, one.properties["dataOlaiBlock"]])).toEqual([["div", "reader"]])
  // The text exactly as written, `[[…]]` and all: the fence is code, so no
  // link was made out of anything in it.
  expect(textOf(placeholders[0]!)).toBe(HOSTILE)
  // What is under it is text in a plain code block, the drawing a reader sees
  // until the face is mounted: no element of the fence's own survives.
  expect(elements(placeholders[0]!).map((one) => one.tagName)).toEqual(["pre", "code"])
})

test("its text is escaped in the HTML", () => {
  const html = renderMarkdown(undefined, fenced("reader", HOSTILE), NOTE, undefined, READER)
  expect(html).toContain(`data-olai-block="reader"`)
  expect(html).not.toContain("<b>")
  expect(html).not.toContain("<script>")
  expect(html).toContain("[[maison]]")
})

test("a fence in any other language is drawn as before", () => {
  for (const source of [fenced("ts", "const a = 1"), fenced("klingon", "nuqneH"), fenced("", "plain")]) {
    expect(renderMarkdown(undefined, source, NOTE, undefined, READER)).toBe(renderMarkdown(undefined, source, NOTE))
  }
})

test("with nothing claimed, a fence in the plugin's language is a code block as before", () => {
  // Rendered without a claim first, under claims the render REMEMBERS by, so
  // a claim seen afterwards must be a different rendering and not the one
  // remembered for this text.
  const before = renderMarkdown(TEST_CLAIMS, fenced("reader", "un | one"), NOTE)
  expect(before).toContain(`<code class="hljs language-reader">`)
  expect(before).not.toContain("data-olai-block")
  expect(renderMarkdown(TEST_CLAIMS, fenced("reader", "un | one"), NOTE, undefined, READER)).toContain(`data-olai-block="reader"`)
  expect(renderMarkdown(TEST_CLAIMS, fenced("reader", "un | one"), NOTE, undefined, new Set())).toBe(before)
  expect(renderMarkdown(TEST_CLAIMS, fenced("reader", "un | one"), NOTE)).toBe(before)
})

test("nothing new passes the sanitiser: a placeholder written into the note is not one", () => {
  for (const source of [
    `<div data-olai-block="reader">un | one</div>\n`,
    `Text <span data-olai-block="reader">un | one</span>.\n`,
  ]) {
    expect(renderMarkdown(undefined, source, NOTE, undefined, READER)).not.toContain("data-olai-block")
  }
})

test("the page's ids are the same with a claim and without", () => {
  const source = `## Beds\n\nA note.[^1]\n\n${fenced("reader", "un | one")}\n[^1]: Footnote.\n`
  const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
  expect(ids(renderMarkdown(undefined, source, NOTE, undefined, READER))).toEqual(ids(renderMarkdown(undefined, source, NOTE)))
})

test("a page opened at a line draws the placeholder too", () => {
  const html = renderLineLanding(undefined, fenced("reader", "un | one"), NOTE, 1, [], undefined, READER)
  expect(html).toContain(`data-olai-block="reader"`)
})
