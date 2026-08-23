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

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import {
  outlineOf,
  renderInlineMarkdown,
  renderMarkdown,
  renderStreaming,
} from "./render.ts"
import { renderTitle } from "./title.ts"
import { TESTID } from "../testids.ts"

installPipeline(pipeline)

const NOTE = "house.olai"

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

// A task list is checkboxes, and a plain item beside them is still a bullet.
// The browser suite is what sees that the checkbox replaced the marker; this
// pins that the pipeline still emitted the inputs.
test("a task list is checkboxes, and a plain item beside them is still a bullet", () => {
  const html = renderMarkdown("- [x] done\n- [ ] not\n- plain\n", NOTE)
  expect(html).toContain(`<input type="checkbox" checked disabled>`)
  expect(html).toContain(`<input type="checkbox" disabled>`)
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
  const one = renderMarkdown(source, "house.olai")
  const other = renderMarkdown(source, "garden.olai")
  expect(one).not.toEqual(other)
  expect(renderMarkdown(source, "house.olai")).toEqual(one)
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

// ...and it SAYS so where the picture would have been. Not drawing it is the
// rule; deleting the element was the bug — a name this app will not resolve
// came out as a page with a hole in it, which nothing and nobody can debug.
// (A name that RESOLVES to a file that is not there is a different case and
// not this module's: it points at `/media/…`, and the browser's own broken
// image is what says so. What this module can see, it now says.)
test("a picture that is not drawn says so, and names what it was", () => {
  const html = renderMarkdown("![a](shot.pngg)", NOTE)
  expect(html).toContain(`data-testid="${TESTID.undrawnPicture}"`)
  expect(html).toContain("this picture could not be drawn: shot.pngg")
})

// The name is the one the MARKDOWN wrote, for every kind of refusal, because
// that is the string a reader has to go and fix.
test("every refused picture names the src that was written", () => {
  for (const src of ["https://example.com/a.png", "/a.png", "logo.svg", "notes.md"]) {
    expect(renderMarkdown(`![a](${src})`, NOTE))
      .toContain(`this picture could not be drawn: ${src}`)
  }
})

// ...except the one there is no longer a name for, and that is the ORDER
// working rather than a hole in it: the sanitiser is the security boundary and
// runs BEFORE this pass, so a `data:` src is gone by the time anything here
// could have quoted it. Same for an `![]()` with nothing in it. Both still say
// so — which is the whole point — in the one sentence that is true of both.
test("a picture whose address never reached us still says so", () => {
  for (const src of ["data:image/png;base64,AA", ""]) {
    const html = renderMarkdown(`![a](${src})`, NOTE)
    expect(html).toContain(`data-testid="${TESTID.undrawnPicture}"`)
    expect(html).toContain("its address was empty, or not one this page may fetch")
  }
})

// ── links between documents ──────────────────────────────────────────────
//
// A vault of Markdown points at itself with plain relative paths, and the
// browser would resolve one against whatever ROUTE the page is at — the
// document's own directory on the document page by luck, and the wrong place on
// `/d/<date>`, where a day's note is drawn under an address that is not a file.
// So the link is resolved beside the file it was WRITTEN in, and spelled as
// this app's document route.

test("a relative link to a document points at that document's page", () => {
  expect(renderMarkdown("[the deck](../projects/deck.md)", "Daily/2026-08-12.md"))
    .toContain(`href="/projects/deck.md"`)
  expect(renderMarkdown("[palette](notes/palette.md)", "finishes.md"))
    .toContain(`href="/notes/palette.md"`)
})

// The base is the FILE, never the route. This is the same source rendered from
// two places, and the day page — where the note lives under `/d/2026-08-12` —
// is the one that used to be wrong.
test("a link in a note resolves beside the note, not beside the page", () => {
  const source = "[palette](palette.md)"
  expect(renderMarkdown(source, "notes/2026-08-12.md"))
    .toContain(`href="/notes/palette.md"`)
  // The same link written in an OUTLINE resolves beside the outline.
  expect(renderMarkdown(source, "house.olai")).toContain(`href="/palette.md"`)
})

// A fragment is two questions — which file, and where in it — so the path is
// resolved and the anchor is carried through exactly as written.
test("a document link keeps the fragment it was written with", () => {
  expect(renderMarkdown("[beds](garden.md#beds)", NOTE))
    .toContain(`href="/garden.md#beds"`)
})

// A filename with a space in it is still a document this vault can point at.
// The href is this app's document route, with the space encoded the way an
// address is printed.

test("a percent-encoded link to a spaced name points at that document's page", () => {
  expect(renderMarkdown("[the brief](the%20brief.md)", "finishes.md"))
    .toContain(`href="/the%20brief.md"`)
  expect(renderMarkdown("[the brief](../the%20brief.md)", "notes/palette.md"))
    .toContain(`href="/the%20brief.md"`)
  expect(renderMarkdown("[scope](the%20brief.md#scope)", NOTE))
    .toContain(`href="/the%20brief.md#scope"`)
})

test("an angle-bracketed link to a spaced name points at that document's page", () => {
  expect(renderMarkdown("[the brief](<the brief.md>)", "finishes.md"))
    .toContain(`href="/the%20brief.md"`)
  expect(renderMarkdown("[scope](<the brief.md#scope>)", NOTE))
    .toContain(`href="/the%20brief.md#scope"`)
})

test("a raw-space link to a spaced name points at that document's page", () => {
  expect(renderMarkdown("[the brief](the brief.md)", "finishes.md"))
    .toContain(`href="/the%20brief.md"`)
})

// Everything else goes where it says. There is no allowlist widened here and
// nothing refused: this pass narrows one shape of link and leaves the rest of
// the reader's markdown alone.
test("a link that is not a relative document is left exactly as written", () => {
  expect(renderMarkdown("[a](https://example.com/x.md)", NOTE))
    .toContain(`href="https://example.com/x.md"`)
  expect(renderMarkdown("[a](/finishes.md)", NOTE)).toContain(`href="/finishes.md"`)
  expect(renderMarkdown("[a](art/handle.png)", NOTE)).toContain(`href="art/handle.png"`)
  expect(renderMarkdown("[a](house.olai)", NOTE)).toContain(`href="house.olai"`)
})

// An http(s) address is still the address — the test above pins that — but
// the click must not be able to throw this tab away. Stamped here, after the
// sanitiser, so a note cannot carry a target of its own and a relative `.md`
// that just became a page address is not treated as something that leaves the app.
test("an external http(s) link opens in a new tab", () => {
  for (const href of ["https://example.com/x.md", "http://example.com/x.md"]) {
    const html = renderMarkdown(`[a](${href})`, NOTE)
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain(`target="_blank"`)
    expect(html).toContain(`rel="noopener noreferrer"`)
  }
})

test("a document link is not sent to a new tab", () => {
  const html = renderMarkdown("[the deck](../projects/deck.md)", "Daily/2026-08-12.md")
  expect(html).toContain(`href="/projects/deck.md"`)
  expect(html).not.toContain("target=")
  expect(html).not.toContain("rel=")
})

test("a fragment-only link is not sent to a new tab", () => {
  const html = renderMarkdown("[up](#top)\n\n# top\n", NOTE)
  expect(html).toMatch(/href="#md-[a-z0-9]+-top"/)
  expect(html).not.toContain("target=")
  expect(html).not.toContain("rel=")
})

// The two passes over one anchor stay in their lanes: a fragment-only link is
// the BLOCK's own business and is minted into this block's namespace, which is
// what keeps a footnote pointing at its own note.
test("a fragment-only link is still minted, not routed", () => {
  const html = renderMarkdown("[up](#top)\n\n# top\n", NOTE)
  expect(html).toMatch(/href="#md-[a-z0-9]+-top"/)
  expect(html).not.toContain("/projects/")
})

// ── heading anchors, and the contents derived from them ──────────────────
//
// The anchor is minted INSIDE the boundary (./anchors.ts), so what is pinned
// here is that it comes out the other side: an id, a href that names it, and
// a label a screen reader can use.
test("a heading carries an id and a link to it", () => {
  const html = renderMarkdown("## The sync loop\n", NOTE)
  const id = /<h2 id="([^"]+)"/.exec(html)?.[1]
  expect(id).toMatch(/^md-[a-z0-9]+-the-sync-loop$/)
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
  expect(renderMarkdown(source, "house.olai")).not
    .toEqual(renderMarkdown(source, "garden.olai"))
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

/**
 * The scheme quick capture writes, all the way through the pipeline.
 *
 * ./sanitise.test.ts holds the SCHEMA against upstream's; this holds the
 * OUTPUT, which is what a note in the inbox actually renders to — a link the
 * browser will hand to the OS, so pressing it opens Mail.app at the message
 * the capture came from. It was stripped before `message:` joined the href
 * protocols, which is the failure the two tests exist between them to keep
 * from coming back.
 *
 * The autolink spelling is the one a capture writes (`@olai/format`'s
 * `inbox.ts`, which the `capture` tool composes through): GFM's autolink
 * literals do not cover this scheme, so a bare URL would have been text either
 * way.
 */
test("a captured mail's message: link survives, in a note and in a title", () => {
  const href = "message://%3Cabc123@mail.example%3E"
  expect(renderMarkdown(`the thread about cabinets\n\n<${href}>\n`, NOTE))
    .toContain(`href="${href}"`)
  expect(renderInlineMarkdown(`[the thread](${href})`, NOTE)).toContain(`href="${href}"`)
  // …and the sibling attribute did NOT come with it: nothing may FETCH one.
  expect(renderMarkdown(`![x](${href})\n`, NOTE)).not.toContain(`src="${href}"`)
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
  expect(html).toContain(`href="https://example.com"`)
  expect(html).toContain(`target="_blank"`)
  expect(html).toContain(`rel="noopener noreferrer"`)
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

// ── what the loss check must NOT mistake for a loss ─────────────────────
//
// The check above compares what was drawn against the text the SOURCE accounts
// for, and that second number is markdown's own reading of the title
// (render.ts's `sourceText`, held against the drawn text by
// title.ts's `lostText`). It used to be a list of regexes — a small
// markdown dialect standing next to the real parser — and these are the titles
// it read wrong: every one of them rendered correctly and was then thrown away
// for its own escaped source.

// Nested emphasis is the shape that started it: `**b *c* d**` matches no
// bold rule whole, so the marks the inner run left behind stayed in the
// estimate, the estimate came out longer than the render, and the row drew
// `a **b *c* d** e` with a stray `*` in it.
test("nested emphasis renders rather than falling back to the source", () => {
  expect(renderTitle("a **b *c* d** e", NOTE)).toBe(
    "a <strong>b <em>c</em> d</strong> e",
  )
})

test("every nesting of the two emphasis marks renders", () => {
  expect(renderTitle("***x***", NOTE)).toBe("<em><strong>x</strong></em>")
  expect(renderTitle("**a *b* c**", NOTE)).toBe(
    "<strong>a <em>b</em> c</strong>",
  )
  expect(renderTitle("*a **b** c*", NOTE)).toBe("<em>a <strong>b</strong> c</em>")
  // The underscore spellings of the same three.
  expect(renderTitle("a __b _c_ d__ e", NOTE)).toBe(
    "a <strong>b <em>c</em> d</strong> e",
  )
  expect(renderTitle("___x___", NOTE)).toBe("<em><strong>x</strong></em>")
  expect(renderTitle("_a __b__ c_", NOTE)).toBe("<em>a <strong>b</strong> c</em>")
})

test("nested emphasis beside a tag keeps the emphasis and the pill", () => {
  const html = renderTitle("**a *b* c** #home", NOTE)
  expect(html).toContain("<strong>a <em>b</em> c</strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
  expect(html).not.toContain("**")
})

test("nested emphasis inside a link's text keeps the link", () => {
  const html = renderTitle("see [**a *b* c**](https://example.com/x)", NOTE)
  expect(html).toContain(`href="https://example.com/x"`)
  expect(html).toContain("<strong>a <em>b</em> c</strong>")
  expect(html).not.toContain("[**")
})

// A character reference is one character of text, and the source spells it in
// five. Counting the spelling made every `&amp;` a loss, and the row drew the
// fallback's re-escaped `&amp;amp;`.
test("a character reference is not read as lost text", () => {
  const html = renderTitle("Tom &amp; Jerry", NOTE)
  expect(html).not.toContain("amp;amp;")
  expect(html.replace(/&#x26;|&amp;/g, "&")).toBe("Tom & Jerry")
})

// Both readings of a title go through `bracketSpacedLinks` (@olai/format, in
// pipeline.ts), so they read one string: `(my file.md)` is a destination to
// the render and would be literal text to a parse that skipped it.
test("a link whose destination holds a space still renders", () => {
  const html = renderTitle("see [the spec](my file.md)", NOTE)
  expect(html).toContain("the spec")
  expect(html).not.toContain("](")
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

// A local picture is not phrasing for titles — it would grow the row — which
// makes such a title one that LOST words: ./inline.ts drops the picture and
// the `alt` goes with it, while the alt is text the source accounts for. So
// this is a fallback like the raw-HTML ones above, and it is pinned as the
// WHOLE string rather than "no <img>, and the word shot is in there
// somewhere": the accounting counts an image's alt (`mdast-util-to-string`'s
// `includeImageAlt`), and turning that off would draw a bare "shot" here and
// sail past the weaker assertion.
test("a picture in a title falls back to the escaped source", () => {
  const html = renderTitle("shot ![a](art/shot.png)", NOTE)
  expect(html).toBe("shot ![a](art/shot.png)")
  expect(html).not.toContain("<img")
})
