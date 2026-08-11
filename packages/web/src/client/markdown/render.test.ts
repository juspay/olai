/**
 * What the pipeline promises, as HTML.
 *
 * These are the features a document leans on — fenced code, footnotes, a
 * relative picture — plus the one thing every markdown renderer has to be held
 * to, which is what it refuses. The e2e suite proves the same things reach a
 * browser; this is where the shape of the output is pinned down cheaply.
 *
 * Titles use the same pipeline forced to phrasing content only: those tests
 * live at the bottom, because "inline-only" is a discipline of its own and a
 * block that escaped into a title would break every row that drew it.
 */

import { expect, test } from "bun:test"

import {
  renderInlineMarkdown,
  renderMarkdown,
  renderStreaming,
} from "./render.ts"
import { renderTitle } from "./title.ts"

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

// ── inline (titles) ────────────────────────────────────────────────────

// Racket parity: a title is phrasing — bold, links, code — never a block.
test("inline markdown keeps bold, code and links", () => {
  const html = renderInlineMarkdown(
    "**bold** and `code` and [a](https://example.com)",
    NOTE,
  )
  expect(html).toContain("<strong>bold</strong>")
  expect(html).toContain("<code>code</code>")
  expect(html).toContain(`<a href="https://example.com">a</a>`)
  // No wrapping paragraph: a title is not a document.
  expect(html).not.toContain("<p")
})

// The whole point of "inline-only": a title that contains block-level source
// must not produce block output that would break a tree row's layout. Words
// stay; boxes do not.
test("inline markdown unwraps blocks rather than drawing them", () => {
  // A heading: the `#` is markdown syntax, so the words remain without an h1.
  const heading = renderInlineMarkdown("# not a heading", NOTE)
  expect(heading).toContain("not a heading")
  expect(heading).not.toMatch(/<h[1-6]/)

  // A list: the item text stays, the list box does not.
  const list = renderInlineMarkdown("- nor a list", NOTE)
  expect(list).toContain("nor a list")
  expect(list).not.toContain("<ul")
  expect(list).not.toContain("<li")

  // A fence: the code stays as phrasing `<code>`, never a `<pre>` block.
  const fence = renderInlineMarkdown("```\nstill words\n```", NOTE)
  expect(fence).toContain("still words")
  expect(fence).not.toContain("<pre")
  expect(fence).toContain("<code")

  // Two paragraphs become one run of phrasing, with a space between.
  const paras = renderInlineMarkdown("foo\n\nbar", NOTE)
  expect(paras).toContain("foo")
  expect(paras).toContain("bar")
  expect(paras).not.toContain("<p")
  expect(paras.replace(/\s+/g, " ")).toMatch(/foo bar/)
})

// Same sanitiser: a title is not a place a script may appear either.
test("inline markdown is sanitised the same way", () => {
  const html = renderInlineMarkdown(
    `<script>alert(1)</script> and [x](javascript:alert(1))`,
    NOTE,
  )
  expect(html).not.toContain("<script")
  expect(html).not.toContain("javascript:")
})

// A streamed answer and its final render must mint the same footnote ids —
// Markdown.tsx switches path the instant streaming ends.
test("streaming and final share a footnote id namespace", () => {
  const source = "Cabinets[^1]\n\n[^1]: Walnut.\n"
  const streamed = renderStreaming(source, NOTE)
  const final = renderMarkdown(source, NOTE)
  const id = /id="(md-[^"]+)"/.exec(final)?.[1]
  expect(id).toBeDefined()
  expect(streamed).toContain(`id="${id}"`)
  expect(streamed).toContain(`href="#${id}"`)
  expect(final).toContain(`href="#${id}"`)
})

// ── titles ─────────────────────────────────────────────────────────────

// Tags are styled AFTER markdown, so a tag inside a construct does not split
// the construct across two parser runs.
test("a title keeps both markdown and its tags", () => {
  const html = renderTitle("**urgent** fix #home", NOTE)
  expect(html).toContain("<strong>urgent</strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
  expect(html).not.toContain("**")
})

// The space before a tag must survive. Assert the literal gap into the tag
// span — not a slice that also covers the span's attributes (those always
// contain whitespace, so a vacuous /\s/ would pass on the regressed html).
test("a title keeps the space before a tag", () => {
  const html = renderTitle("kitchen remodel #home", NOTE)
  expect(html).toContain("remodel <span")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
})

// Tag-inside-construct: the cases the pre-markdown split destroyed.
test("a tag inside bold stays bold", () => {
  const html = renderTitle("**urgent #home**", NOTE)
  expect(html).toContain("<strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
  expect(html).not.toContain("**")
  // The tag span sits inside the strong, not as a sibling of broken source.
  expect(html).toMatch(/<strong>[\s\S]*data-testid="tag"[\s\S]*<\/strong>/)
})

test("a tag inside code stays code, not a styled tag", () => {
  const html = renderTitle("`#home` config", NOTE)
  expect(html).toContain("<code>")
  expect(html).toContain("#home")
  // code subtrees are not walked for tags.
  expect(html).not.toContain(`data-testid="tag"`)
})

test("a link with a URL fragment is not shredded by the tag alphabet", () => {
  const html = renderTitle("see [spec](https://example.com/x#home)", NOTE)
  expect(html).toContain(`href="https://example.com/x#home"`)
  expect(html).toContain("spec")
  // The fragment is on the href, not a tag in the text.
  expect(html).not.toContain(`data-testid="tag"`)
  expect(html).not.toContain("[spec]")
})

test("a tag that is the link text stays a link, not a split", () => {
  const html = renderTitle("[#home](https://example.com)", NOTE)
  expect(html).toContain(`href="https://example.com"`)
  expect(html).toContain("#home")
  // Inside <a>, tags are not re-styled (skip a subtrees).
  expect(html).not.toContain(`data-testid="tag"`)
})

// Empty render of non-empty source → escaped source, never a blank row.
test("a title that the pipeline empties falls back to the escaped source", () => {
  for (const source of ["---", "***", "___", "<div>plan the trip</div>", "<!-- note -->"]) {
    const html = renderTitle(source, NOTE)
    expect(html.length).toBeGreaterThan(0)
    // No empty string; the marks (escaped if needed) are what the row shows.
    expect(html).not.toBe("")
  }
  // Raw HTML angle brackets must not open an element in the fallback.
  expect(renderTitle("<div>plan</div>", NOTE)).not.toContain("<div")
  expect(renderTitle("<div>plan</div>", NOTE)).toContain("plan")
})

// Inside a Link (breadcrumb, see-ref): no nested <a>.
test("a title with links=false unwraps anchors", () => {
  const html = renderTitle("see [the spec](https://example.com/x)", NOTE, {
    links: false,
  })
  expect(html).toContain("the spec")
  expect(html).not.toContain("<a")
  expect(html).not.toContain("href=")
})

// A local picture is not phrasing for titles — it would grow the row.
test("a picture in a title is not drawn", () => {
  const html = renderTitle("shot ![a](art/shot.png)", NOTE)
  expect(html).not.toContain("<img")
  expect(html).toContain("shot")
})
