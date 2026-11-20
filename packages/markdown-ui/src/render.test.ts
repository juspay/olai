import { claims } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { TESTID } from "@olai/markdown-ui/testids.ts"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import {
  outlineOf,
  renderInlineMarkdown,
  renderMarkdown,
  renderStreaming,
} from "./render.ts"
import type { TitleRender } from "./title.ts"
import { renderTitle } from "./title.ts"


installPipeline(pipeline)

const NOTE = "house.olai"

test("a fenced block is highlighted, in classes rather than colours", () => {
  const html = renderMarkdown(TEST_CLAIMS, "```ts\nconst a = 1\n```\n", NOTE)
  expect(html).toContain(`<code class="hljs language-ts">`)
  expect(html).toContain(`<span class="hljs-keyword">const</span>`)
})

test("a nix fence is highlighted", () => {
  const html = renderMarkdown(TEST_CLAIMS, "```nix\npkgs.mkShell { name = \"olai\"; }\n```\n", NOTE)
  expect(html).toContain(`<code class="hljs language-nix">`)
  expect(html).toContain(`<span class="hljs-string">"olai"</span>`)
})

test("a fence in a language nobody registered is left alone", () => {
  const html = renderMarkdown(TEST_CLAIMS, "```klingon\nnuqneH\n```\n", NOTE)
  expect(html).toContain("nuqneH")
  expect(html).not.toContain("hljs-")
})

test("a task list is checkboxes, and a plain item beside them is still a bullet", () => {
  const html = renderMarkdown(TEST_CLAIMS, "- [x] done\n- [ ] not\n- plain\n", NOTE)
  expect(html).toContain(`<input type="checkbox" checked disabled>`)
  expect(html).toContain(`<input type="checkbox" disabled>`)
  expect(html).toContain("<li>plain</li>")
})

test("a footnote is a link to a note at the end", () => {
  const html = renderMarkdown(TEST_CLAIMS, "Cabinets[^1]\n\n[^1]: Walnut.\n", NOTE)
  expect(html).toContain("Walnut.")
  expect(html).toContain(`class="footnotes"`)
  const reference = /href="#([^"]+)"/.exec(html)?.[1]
  expect(reference).toBeDefined()
  expect(html).toContain(`id="${reference}"`)
})

test("footnote ids belong to the block, not to the parser", () => {
  const source = "Cabinets[^1]\n\n[^1]: Walnut.\n"
  const one = renderMarkdown(TEST_CLAIMS, source, "house.olai")
  const other = renderMarkdown(TEST_CLAIMS, source, "garden.olai")
  expect(one).not.toEqual(other)
  expect(renderMarkdown(TEST_CLAIMS, source, "house.olai")).toEqual(one)
  expect(one).not.toContain(`id="fn-1"`)
  expect(one).toMatch(/id="md-[a-z0-9]+-fn-1"/)
})

test("a relative picture points at the media route", () => {
  expect(renderMarkdown(TEST_CLAIMS, "![a](art/shot.png)", "notes/plan.md"))
    .toContain(`src="/media/notes/art/shot.png"`)
  expect(renderMarkdown(TEST_CLAIMS, "![a](../shot.png)", "notes/plan.md"))
    .toContain(`src="/media/shot.png"`)
})

test("the first picture of a block is fetched at once and the rest wait", () => {
  const html = renderMarkdown(TEST_CLAIMS, "![a](art/shot.png)\n\n![b](../shot.png)\n", "notes/plan.md")
  expect(html).toContain(`<img src="/media/notes/art/shot.png" alt="a" loading="eager" decoding="async">`)
  expect(html).toContain(`<img src="/media/shot.png" alt="b" loading="lazy" decoding="async">`)
  const after = renderMarkdown(TEST_CLAIMS, "![a](shot.pngg)\n\n![b](art/shot.png)\n", "notes/plan.md")
  expect(after).toContain(`loading="eager"`)
  expect(after).not.toContain(`loading="lazy"`)
})

test("a picture this app will not fetch is not drawn", () => {
  for (const src of ["https://example.com/a.png", "data:image/png;base64,AA", "/a.png"]) {
    expect(renderMarkdown(TEST_CLAIMS, `![a](${src})`, NOTE)).not.toContain("<img")
  }
  expect(renderMarkdown(TEST_CLAIMS, "![a](notes.md)", NOTE)).not.toContain("<img")
})

test("a picture that is not drawn says so, and names what it was", () => {
  const html = renderMarkdown(TEST_CLAIMS, "![a](shot.pngg)", NOTE)
  expect(html).toContain(`data-testid="${TESTID.undrawnPicture}"`)
  expect(html).toContain("this picture could not be drawn: shot.pngg")
})

test("every refused picture names the src that was written", () => {
  for (const src of ["https://example.com/a.png", "/a.png", "logo.svg", "notes.md"]) {
    expect(renderMarkdown(TEST_CLAIMS, `![a](${src})`, NOTE))
      .toContain(`this picture could not be drawn: ${src}`)
  }
})

test("a picture whose address never reached us still says so", () => {
  for (const src of ["data:image/png;base64,AA", ""]) {
    const html = renderMarkdown(TEST_CLAIMS, `![a](${src})`, NOTE)
    expect(html).toContain(`data-testid="${TESTID.undrawnPicture}"`)
    expect(html).toContain("its address was empty, or not one this page may fetch")
  }
})

test("a relative link to a document points at that document's page", () => {
  expect(renderMarkdown(TEST_CLAIMS, "[the deck](../projects/deck.md)", "Daily/2026-08-12.md"))
    .toContain(`href="/projects/deck.md"`)
  expect(renderMarkdown(TEST_CLAIMS, "[palette](notes/palette.md)", "finishes.md"))
    .toContain(`href="/notes/palette.md"`)
})

test("a link in a note resolves beside the note, not beside the page", () => {
  const source = "[palette](palette.md)"
  expect(renderMarkdown(TEST_CLAIMS, source, "notes/2026-08-12.md"))
    .toContain(`href="/notes/palette.md"`)
  expect(renderMarkdown(TEST_CLAIMS, source, "house.olai")).toContain(`href="/palette.md"`)
})

test("a document link keeps the fragment it was written with", () => {
  expect(renderMarkdown(TEST_CLAIMS, "[beds](garden.md#beds)", NOTE))
    .toContain(`href="/garden.md#beds"`)
})

test("a percent-encoded link to a spaced name points at that document's page", () => {
  expect(renderMarkdown(TEST_CLAIMS, "[the brief](the%20brief.md)", "finishes.md"))
    .toContain(`href="/the%20brief.md"`)
  expect(renderMarkdown(TEST_CLAIMS, "[the brief](../the%20brief.md)", "notes/palette.md"))
    .toContain(`href="/the%20brief.md"`)
  expect(renderMarkdown(TEST_CLAIMS, "[scope](the%20brief.md#scope)", NOTE))
    .toContain(`href="/the%20brief.md#scope"`)
})

test("an angle-bracketed link to a spaced name points at that document's page", () => {
  expect(renderMarkdown(TEST_CLAIMS, "[the brief](<the brief.md>)", "finishes.md"))
    .toContain(`href="/the%20brief.md"`)
  expect(renderMarkdown(TEST_CLAIMS, "[scope](<the brief.md#scope>)", NOTE))
    .toContain(`href="/the%20brief.md#scope"`)
})

test("a raw-space link to a spaced name points at that document's page", () => {
  expect(renderMarkdown(TEST_CLAIMS, "[the brief](the brief.md)", "finishes.md"))
    .toContain(`href="/the%20brief.md"`)
})

test("a link that is not a relative document is left exactly as written", () => {
  expect(renderMarkdown(TEST_CLAIMS, "[a](https://example.com/x.md)", NOTE))
    .toContain(`href="https://example.com/x.md"`)
  expect(renderMarkdown(TEST_CLAIMS, "[a](/finishes.md)", NOTE)).toContain(`href="/finishes.md"`)
  expect(renderMarkdown(TEST_CLAIMS, "[a](notes/rows.tsv)", NOTE)).toContain(`href="notes/rows.tsv"`)
  expect(renderMarkdown(TEST_CLAIMS, "[a](house.olai)", NOTE)).toContain(`href="house.olai"`)
})

test("a relative link to a picture opens that picture's page", () => {
  expect(renderMarkdown(TEST_CLAIMS, "[a](art/handle.png)", NOTE)).toContain(`href="/art/handle.png"`)
  expect(renderMarkdown(TEST_CLAIMS, "![a](art/handle.png)", NOTE))
    .toContain(`src="/media/art/handle.png"`)
})

test("an external http(s) link opens in a new tab", () => {
  for (const href of ["https://example.com/x.md", "http://example.com/x.md"]) {
    const html = renderMarkdown(TEST_CLAIMS, `[a](${href})`, NOTE)
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain(`target="_blank"`)
    expect(html).toContain(`rel="noopener noreferrer"`)
  }
})

test("a document link is not sent to a new tab", () => {
  const html = renderMarkdown(TEST_CLAIMS, "[the deck](../projects/deck.md)", "Daily/2026-08-12.md")
  expect(html).toContain(`href="/projects/deck.md"`)
  expect(html).not.toContain("target=")
  expect(html).not.toContain("rel=")
})

test("a fragment-only link is not sent to a new tab", () => {
  const html = renderMarkdown(TEST_CLAIMS, "[up](#top)\n\n# top\n", NOTE)
  expect(html).toMatch(/href="#md-[a-z0-9]+-top"/)
  expect(html).not.toContain("target=")
  expect(html).not.toContain("rel=")
})

test("a fragment-only link is still minted, not routed", () => {
  const html = renderMarkdown(TEST_CLAIMS, "[up](#top)\n\n# top\n", NOTE)
  expect(html).toMatch(/href="#md-[a-z0-9]+-top"/)
  expect(html).not.toContain("/projects/")
})

test("a heading carries an id and a link to it", () => {
  const html = renderMarkdown(TEST_CLAIMS, "## The sync loop\n", NOTE)
  const id = /<h2 id="([^"]+)"/.exec(html)?.[1]
  expect(id).toMatch(/^md-[a-z0-9]+-the-sync-loop$/)
  expect(html).toContain(`href="#${id}"`)
  expect(html).toContain("aria-label=\"Link to “The sync loop”\"")
})

test("heading ids belong to the block, not to the parser", () => {
  const source = "## Shape\n"
  expect(renderMarkdown(TEST_CLAIMS, source, "house.olai")).not
    .toEqual(renderMarkdown(TEST_CLAIMS, source, "garden.olai"))
})

test("the outline names the ids the page carries", () => {
  const source = "# Top\n\n## The `sync` loop\n\n### Deeper\n"
  const html = renderMarkdown(TEST_CLAIMS, source, NOTE)
  const headings = outlineOf(TEST_CLAIMS, source, NOTE)

  expect(headings.map((heading) => [heading.depth, heading.text]))
    .toEqual([[1, "Top"], [2, "The sync loop"], [3, "Deeper"]])
  for (const heading of headings) expect(html).toContain(`id="${heading.id}"`)
})

test("the anchor is not part of the heading's text", () => {
  expect(outlineOf(TEST_CLAIMS, "## Shape\n", NOTE).map((heading) => heading.text)).toEqual(["Shape"])
})

test("the outline and the body are one run, not two", () => {
  const source = "# Top\n\n## Shape\n\n### Deeper\n"
  const from = "one-run.md"

  const first = outlineOf(TEST_CLAIMS, source, from)
  renderMarkdown(TEST_CLAIMS, source, from)
  expect(outlineOf(TEST_CLAIMS, source, from)).toBe(first)

  const other = "other.md"
  renderMarkdown(TEST_CLAIMS, source, other)
  expect(outlineOf(TEST_CLAIMS, source, other)).toBe(outlineOf(TEST_CLAIMS, source, other))
})

test("a document with no headings has no outline", () => {
  expect(outlineOf(TEST_CLAIMS, "Just a paragraph.\n", NOTE)).toEqual([])
})

test("a script is not markdown", () => {
  const html = renderMarkdown(TEST_CLAIMS,
    `<script>alert(1)</script>\n\n[x](javascript:alert(1))\n`,
    NOTE,
  )
  expect(html).not.toContain("<script")
  expect(html).not.toContain("javascript:")
})

test("a captured mail's message: link survives, in a note and in a title", () => {
  const href = "message://%3Cabc123@mail.example%3E"
  expect(renderMarkdown(TEST_CLAIMS, `the thread about cabinets\n\n<${href}>\n`, NOTE))
    .toContain(`href="${href}"`)
  expect(renderInlineMarkdown(TEST_CLAIMS, `[the thread](${href})`, NOTE)).toContain(`href="${href}"`)
  expect(renderMarkdown(TEST_CLAIMS, `![x](${href})\n`, NOTE)).not.toContain(`src="${href}"`)
})

test("inline markdown keeps bold, code and links", () => {
  const html = renderInlineMarkdown(TEST_CLAIMS,
    "**bold** and `code` and [a](https://example.com)",
    NOTE,
  )
  expect(html).toContain("<strong>bold</strong>")
  expect(html).toContain("<code>code</code>")
  expect(html).toContain(`href="https://example.com"`)
  expect(html).toContain(`target="_blank"`)
  expect(html).toContain(`rel="noopener noreferrer"`)
  expect(html).not.toContain("<p")
})

test("inline markdown unwraps blocks rather than drawing them", () => {
  const heading = renderInlineMarkdown(TEST_CLAIMS, "# not a heading", NOTE)
  expect(heading).toContain("not a heading")
  expect(heading).not.toMatch(/<h[1-6]/)

  const list = renderInlineMarkdown(TEST_CLAIMS, "- nor a list", NOTE)
  expect(list).toContain("nor a list")
  expect(list).not.toContain("<ul")
  expect(list).not.toContain("<li")

  const fence = renderInlineMarkdown(TEST_CLAIMS, "```\nstill words\n```", NOTE)
  expect(fence).toContain("still words")
  expect(fence).not.toContain("<pre")
  expect(fence).toContain("<code")

  const paras = renderInlineMarkdown(TEST_CLAIMS, "foo\n\nbar", NOTE)
  expect(paras).toContain("foo")
  expect(paras).toContain("bar")
  expect(paras).not.toContain("<p")
  expect(paras.replace(/\s+/g, " ")).toMatch(/foo bar/)
})

test("inline markdown is sanitised the same way", () => {
  const html = renderInlineMarkdown(TEST_CLAIMS,
    `<script>alert(1)</script> and [x](javascript:alert(1))`,
    NOTE,
  )
  expect(html).not.toContain("<script")
  expect(html).not.toContain("javascript:")
})

test("streaming and final share a footnote id namespace", () => {
  const source = "Cabinets[^1]\n\n[^1]: Walnut.\n"
  const streamed = renderStreaming(TEST_CLAIMS, source, NOTE)
  const final = renderMarkdown(TEST_CLAIMS, source, NOTE)
  const id = /id="(md-[^"]+)"/.exec(final)?.[1]
  expect(id).toBeDefined()
  expect(streamed).toContain(`id="${id}"`)
  expect(streamed).toContain(`href="#${id}"`)
  expect(final).toContain(`href="#${id}"`)
})

const titleHtml = (title: string, from: string, options?: TitleRender): string =>
  renderTitle(TEST_CLAIMS, title, from, options).html

test("a title keeps both markdown and its tags", () => {
  const html = titleHtml("**urgent** fix #home", NOTE)
  expect(html).toContain("<strong>urgent</strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
  expect(html).not.toContain("**")
})

test("a title keeps the space before a tag", () => {
  const html = titleHtml("kitchen remodel #home", NOTE)
  expect(html).toContain("remodel <span")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
})

test("a tag inside bold stays bold", () => {
  const html = titleHtml("**urgent #home**", NOTE)
  expect(html).toContain("<strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
  expect(html).not.toContain("**")
  expect(html).toMatch(/<strong>[\s\S]*data-testid="tag"[\s\S]*<\/strong>/)
})

test("a tag inside code stays code, not a styled tag", () => {
  const html = titleHtml("`#home` config", NOTE)
  expect(html).toContain("<code>")
  expect(html).toContain("#home")
  expect(html).not.toContain(`data-testid="tag"`)
})

test("a link with a URL fragment is not shredded by the tag alphabet", () => {
  const html = titleHtml("see [spec](https://example.com/x#home)", NOTE)
  expect(html).toContain(`href="https://example.com/x#home"`)
  expect(html).toContain("spec")
  expect(html).not.toContain(`data-testid="tag"`)
  expect(html).not.toContain("[spec]")
})

test("a tag that is the link text stays a link, not a split", () => {
  const html = titleHtml("[#home](https://example.com)", NOTE)
  expect(html).toContain(`href="https://example.com"`)
  expect(html).toContain("#home")
  expect(html).not.toContain(`data-testid="tag"`)
})

test("a title that the pipeline empties falls back to the escaped source", () => {
  for (const source of ["---", "***", "___", "<div>plan the trip</div>", "<!-- note -->"]) {
    const html = titleHtml(source, NOTE)
    expect(html.length).toBeGreaterThan(0)
    expect(html).not.toBe("")
  }
  expect(titleHtml("<div>plan</div>", NOTE)).not.toContain("<div")
  expect(titleHtml("<div>plan</div>", NOTE)).toContain("plan")
})

test("a title that loses words to raw HTML falls back to the escaped source", () => {
  const component = titleHtml("Use <Component> here", NOTE)
  expect(component).toContain("Component")
  expect(component).not.toContain("<Component")
  expect(component).toContain("Use")
  expect(component).toContain("here")
  expect(component).toContain("&lt;")

  const algo = titleHtml("C++ <algorithm>", NOTE)
  expect(algo).toContain("algorithm")
  expect(algo).toContain("&lt;")
  expect(algo.replace(/&lt;|&gt;|&amp;|&quot;/g, "")).toContain("algorithm")
})

test("a normal markdown title does not fall back to escaped source", () => {
  const html = titleHtml("**urgent** fix #home", NOTE)
  expect(html).toContain("<strong>urgent</strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).not.toContain("**")
  expect(html).not.toContain("&lt;")
})

test("nested emphasis renders rather than falling back to the source", () => {
  expect(titleHtml("a **b *c* d** e", NOTE)).toBe(
    "a <strong>b <em>c</em> d</strong> e",
  )
})

test("every nesting of the two emphasis marks renders", () => {
  expect(titleHtml("***x***", NOTE)).toBe("<em><strong>x</strong></em>")
  expect(titleHtml("**a *b* c**", NOTE)).toBe(
    "<strong>a <em>b</em> c</strong>",
  )
  expect(titleHtml("*a **b** c*", NOTE)).toBe("<em>a <strong>b</strong> c</em>")
  expect(titleHtml("a __b _c_ d__ e", NOTE)).toBe(
    "a <strong>b <em>c</em> d</strong> e",
  )
  expect(titleHtml("___x___", NOTE)).toBe("<em><strong>x</strong></em>")
  expect(titleHtml("_a __b__ c_", NOTE)).toBe("<em>a <strong>b</strong> c</em>")
})

test("nested emphasis beside a tag keeps the emphasis and the pill", () => {
  const html = titleHtml("**a *b* c** #home", NOTE)
  expect(html).toContain("<strong>a <em>b</em> c</strong>")
  expect(html).toContain(`data-testid="tag"`)
  expect(html).toContain("#home")
  expect(html).not.toContain("**")
})

test("nested emphasis inside a link's text keeps the link", () => {
  const html = titleHtml("see [**a *b* c**](https://example.com/x)", NOTE)
  expect(html).toContain(`href="https://example.com/x"`)
  expect(html).toContain("<strong>a <em>b</em> c</strong>")
  expect(html).not.toContain("[**")
})

test("a character reference is not read as lost text", () => {
  const html = titleHtml("Tom &amp; Jerry", NOTE)
  expect(html).not.toContain("amp;amp;")
  expect(html.replace(/&#x26;|&amp;/g, "&")).toBe("Tom & Jerry")
})

test("a link whose destination holds a space still renders", () => {
  const html = titleHtml("see [the spec](my file.md)", NOTE)
  expect(html).toContain("the spec")
  expect(html).not.toContain("](")
})

test("a title with links=false unwraps anchors", () => {
  const html = titleHtml("see [the spec](https://example.com/x)", NOTE, {
    links: false,
  })
  expect(html).toContain("the spec")
  expect(html).not.toContain("<a")
  expect(html).not.toContain("href=")
})

test("a picture in a title falls back to the escaped source", () => {
  const html = titleHtml("shot ![a](art/shot.png)", NOTE)
  expect(html).toBe("shot ![a](art/shot.png)")
  expect(html).not.toContain("<img")
})

test("a rendering cache belongs to its Claims snapshot, including withdrawal and return", () => {
  const source = "![shot](shot.png) [notes](notes.md)"
  const without = claims([...TEST_CLAIMS.byKind.values()].filter(claim => claim.kind !== "image" && claim.kind !== "markdown"))
  const before = renderMarkdown(TEST_CLAIMS, source, "Work.olai")
  expect(before).toContain('/media/shot.png')
  expect(before).toContain('href="/notes.md"')
  const off = renderMarkdown(without, source, "Work.olai")
  expect(off).not.toContain('/media/shot.png')
  expect(off).not.toContain('href="/notes.md"')
  expect(renderMarkdown(undefined, source, "Work.olai")).toBe(off)
  expect(renderMarkdown(TEST_CLAIMS, source, "Work.olai")).toBe(before)
})

test("a resolved link carries the facts the dead-link pass reads", () => {
  const html = renderMarkdown(TEST_CLAIMS, "[x](../gone%20away.md#scope)", "notes/a.md")
  expect(html).toContain('data-link-path="gone away.md"')
  expect(html).toContain('data-link-written="../gone%20away.md#scope"')
  expect(html).toContain('href="/gone%20away.md#scope"')
  expect(html).not.toContain("data-dead")
})
