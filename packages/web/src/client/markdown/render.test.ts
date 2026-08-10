/**
 * What the pipeline promises, as HTML.
 *
 * These are the features a document leans on — fenced code, footnotes, a
 * relative picture — plus the one thing every markdown renderer has to be held
 * to, which is what it refuses. The e2e suite proves the same things reach a
 * browser; this is where the shape of the output is pinned down cheaply.
 */

import { expect, test } from "bun:test"

import { renderMarkdown } from "./render.ts"

const NOTE = "house.jsonl"

test("a fenced block is highlighted, in classes rather than colours", () => {
  const html = renderMarkdown("```ts\nconst a = 1\n```\n", NOTE)
  expect(html).toContain(`<code class="hljs language-ts">`)
  expect(html).toContain(`<span class="hljs-keyword">const</span>`)
})

// An unknown language is not an error and not a reason to lose the block: it
// is drawn as what it is, plain text.
test("a fence in a language nobody registered is left alone", () => {
  const html = renderMarkdown("```klingon\nnuqneH\n```\n", NOTE)
  expect(html).toContain("nuqneH")
  expect(html).not.toContain("hljs-")
})

test("a footnote is a link to a note at the end", () => {
  const html = renderMarkdown("Cabinets[^1]\n\n[^1]: Walnut.\n", NOTE)
  expect(html).toContain("Walnut.")
  expect(html).toContain(`class="footnotes"`)
  // The link and the note it names agree, which is the whole of a footnote.
  const reference = /href="#([^"]+)"/.exec(html)?.[1]
  expect(reference).toBeDefined()
  expect(html).toContain(`id="${reference}"`)
})

// Every rendered block on a page mints its own ids, so two notes' footnotes
// cannot answer for each other — and the SAME text renders the same ids every
// time, because a live frame re-renders the page and links that moved would
// break under the reader's cursor.
test("footnote ids belong to the block, not to the parser", () => {
  const source = "Cabinets[^1]\n\n[^1]: Walnut.\n"
  const one = renderMarkdown(source, "house.jsonl")
  const other = renderMarkdown(source, "garden.jsonl")
  expect(one).not.toEqual(other)
  expect(renderMarkdown(source, "house.jsonl")).toEqual(one)
  // Nothing is left with the parser's own bare `fn-1`.
  expect(one).not.toContain(`id="fn-1"`)
  expect(one).toMatch(/id="md-[a-z0-9]+-fn-1"/)
})

// A relative picture is a file in the served directory, resolved beside the
// text that named it and fetched from the one route that serves them.
test("a relative picture points at the media route", () => {
  expect(renderMarkdown("![a](art/shot.png)", "notes/plan.md"))
    .toContain(`src="/media/notes/art/shot.png"`)
  expect(renderMarkdown("![a](../shot.png)", "notes/plan.md"))
    .toContain(`src="/media/shot.png"`)
})

// Anything else is not drawn AT ALL — a remote image would tell a third party
// what someone is reading, and the rest are ways of drawing something that is
// not a file in this directory.
test("a picture this app will not fetch is not drawn", () => {
  for (const src of ["https://example.com/a.png", "data:image/png;base64,AA", "/a.png"]) {
    expect(renderMarkdown(`![a](${src})`, NOTE)).not.toContain("<img")
  }
  // Not a picture, so not an image either, whatever the route would say.
  expect(renderMarkdown("![a](notes.md)", NOTE)).not.toContain("<img")
})

// The reason it is safe to hand this to `innerHTML`. These files are written
// by people, by agents and by git merges.
test("a script is not markdown", () => {
  const html = renderMarkdown(
    `<script>alert(1)</script>\n\n[x](javascript:alert(1))\n`,
    NOTE,
  )
  expect(html).not.toContain("<script")
  expect(html).not.toContain("javascript:")
})
