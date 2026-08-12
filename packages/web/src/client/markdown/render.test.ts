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
 *
 * The pipeline is a chunk the browser fetches (./chunk.ts), and there is no
 * shell here to read its URL from — so this file imports the same module the
 * browser ends up with and installs it, which is what keeps these tests tests
 * of the thing that ships. What the page does BEFORE it arrives is a question
 * about a page, and is answered in the browser suite
 * (`packages/tests/features/markdown_arrives.feature`).
 */

import { expect, test } from "bun:test"

import { ANCHOR_CLASS } from "./anchors.ts"
import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import {
  outlineOf,
  renderInlineMarkdown,
  renderMarkdown,
  renderStreaming,
} from "./render.ts"
import { renderTitle } from "./title.ts"

installPipeline(pipeline)

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
    expect(html).not.toBe("")
  }
  // Raw HTML angle brackets must not open an element in the fallback.
  expect(renderTitle("<div>plan</div>", NOTE)).not.toContain("<div")
  expect(renderTitle("<div>plan</div>", NOTE)).toContain("plan")
})

// Partial loss: the pipeline kept some text but dropped a word inside raw
// HTML. Falling back only on full emptiness left a title that looked correct
// while being wrong — worse than the marks.
test("a title that loses words to raw HTML falls back to the escaped source", () => {
  const component = renderTitle("Use <Component> here", NOTE)
  expect(component).toContain("Component")
  expect(component).not.toContain("<Component")
  // Escaped, not the truncated "Use  here".
  expect(component).toContain("Use")
  expect(component).toContain("here")
  expect(component).toContain("&lt;")

  const algo = renderTitle("C++ <algorithm>", NOTE)
  expect(algo).toContain("algorithm")
  expect(algo).toContain("&lt;")
  // Must not be the truncated "C++ " with the word gone.
  expect(algo.replace(/&lt;|&gt;|&amp;|&quot;/g, "")).toContain("algorithm")
})

// Ordinary markdown still renders — the loss check must not fire on every title.
test("a normal markdown title does not fall back to escaped source", () => {
  const html = renderTitle("**urgent** fix #home", NOTE)
  expect(html).toContain("<strong>urgent</strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).not.toContain("**")
  expect(html).not.toContain("&lt;")
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
