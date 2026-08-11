/**
 * What the pipeline promises, as HTML.
 *
 * These are the features a document leans on — fenced code, footnotes, a
 * relative picture — plus the one thing every markdown renderer has to be held
 * to, which is what it refuses. The e2e suite proves the same things reach a
 * browser; this is where the shape of the output is pinned down cheaply.
 */

import { expect, test } from "bun:test"

import { ANCHOR_CLASS } from "./anchors.ts"
import { outlineOf, renderMarkdown } from "./render.ts"

const NOTE = "house.jsonl"

test("a fenced block is highlighted, in classes rather than colours", () => {
  const html = renderMarkdown("```ts\nconst a = 1\n```\n", NOTE)
  expect(html).toContain(`<code class="hljs language-ts">`)
  expect(html).toContain(`<span class="hljs-keyword">const</span>`)
})

// Nix is registered ON TOP of lowlight's common set rather than instead of it
// (render.ts says why). Only the addition needs its own test: the test above
// is a `ts` fence, which is IN that common set, so a `languages` option that
// stopped spreading it fails there first.
test("a nix fence is highlighted", () => {
  const html = renderMarkdown("```nix\npkgs.mkShell { name = \"olai\"; }\n```\n", NOTE)
  expect(html).toContain(`<code class="hljs language-nix">`)
  expect(html).toContain(`<span class="hljs-string">"olai"</span>`)
})

// An unknown language is not an error and not a reason to lose the block: it
// is drawn as what it is, plain text.
test("a fence in a language nobody registered is left alone", () => {
  const html = renderMarkdown("```klingon\nnuqneH\n```\n", NOTE)
  expect(html).toContain("nuqneH")
  expect(html).not.toContain("hljs-")
})

// The sanitiser decides which of the parser's classes survive, and a task
// list's are the ones `styles.css` hangs a rule on: the checkbox replaces the
// bullet, so a dropped class is a list drawn with two markers and nothing in
// the markup to say why. Pinned here rather than left to the browser test,
// which can only see the result.
test("a task list keeps the classes the stylesheet draws it by", () => {
  const html = renderMarkdown("- [x] done\n- [ ] not\n- plain\n", NOTE)
  expect(html).toContain(`<ul class="contains-task-list">`)
  expect(html).toContain(`<li class="task-list-item"><input type="checkbox" checked disabled>`)
  // The plain item is untouched: it keeps the bullet the other two give up.
  expect(html).toContain("<li>plain</li>")
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

// ── heading anchors, and the contents derived from them ──────────────────
//
// The anchor is minted INSIDE the boundary (./anchors.ts), so what is pinned
// here is that it comes out the other side: an allowlist that stopped naming
// the class would leave the link working and the styling gone, which is
// exactly the kind of thing nothing else notices.
test("a heading carries an id and a link to it", () => {
  const html = renderMarkdown("## The sync loop\n", NOTE)
  const id = /<h2 id="([^"]+)"/.exec(html)?.[1]
  expect(id).toMatch(/^md-[a-z0-9]+-the-sync-loop$/)
  expect(html).toContain(`<a class="${ANCHOR_CLASS}"`)
  expect(html).toContain(`href="#${id}"`)
  // The label names the section: a page of anchors is a page of `#`s to
  // anyone reading by ear.
  expect(html).toContain("aria-label=\"Link to “The sync loop”\"")
})

// Every rendered block on a page mints its own, for the reason footnotes do:
// two notes both opening `## Shape` would otherwise answer for each other.
// (That the id is namespaced at all is the regex above; what is left to say is
// that the namespace is the BLOCK's.)
test("heading ids belong to the block, not to the parser", () => {
  const source = "## Shape\n"
  expect(renderMarkdown(source, "house.jsonl")).not
    .toEqual(renderMarkdown(source, "garden.jsonl"))
})

// The contents is derived from the RENDERING, so what it points at is what is
// on the page — the whole reason it is not parsed out of the source again.
test("the outline names the ids the page carries", () => {
  const source = "# Top\n\n## The `sync` loop\n\n### Deeper\n"
  const html = renderMarkdown(source, NOTE)
  const headings = outlineOf(source, NOTE)

  expect(headings.map((heading) => [heading.depth, heading.text]))
    .toEqual([[1, "Top"], [2, "The sync loop"], [3, "Deeper"]])
  for (const heading of headings) expect(html).toContain(`id="${heading.id}"`)
})

// The anchor is a CHILD of the heading, so the naive reading puts a hash on
// the end of every line of the contents.
test("the anchor is not part of the heading's text", () => {
  expect(outlineOf("## Shape\n", NOTE).map((heading) => heading.text)).toEqual(["Shape"])
})

// ONE RUN between the two entry points, which is the whole reason a contents
// costs nothing: the page asks for the outline and the component asks for the
// HTML, and neither is a second pass over the same text.
//
// Read off IDENTITY, because a second run is invisible in the output — it
// would produce an equal outline, one `Heading` object at a time. So: take the
// outline, render the body exactly as the page then does, and ask for the
// outline again. Same array means the body's render found the memo and did not
// replace it. Split `outlineOf` onto a parse of its own and this is red.
test("the outline and the body are one run, not two", () => {
  const source = "# Top\n\n## Shape\n\n### Deeper\n"
  const from = "one-run.md"

  const first = outlineOf(source, from)
  renderMarkdown(source, from)
  expect(outlineOf(source, from)).toBe(first)

  // …and the other way round, since the page may ask in either order.
  const other = "other.md"
  renderMarkdown(source, other)
  expect(outlineOf(source, other)).toBe(outlineOf(source, other))
})

// Nothing to choose between, and nothing to point at: neither is a contents.
test("a document with no headings has no outline", () => {
  expect(outlineOf("Just a paragraph.\n", NOTE)).toEqual([])
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
