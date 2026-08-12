/**
 * Markdown, rendered.
 *
 * Markdown is interpreted only at view time; the text on disk stays verbatim,
 * so this is a pure function from a string in a file to HTML — no caching
 * layer on disk, no pre-rendered field in a record, nothing that could go
 * stale. One pipeline serves every piece of markdown this app draws: a node's
 * note, a whole `.md` document, what the agent says in the chat panel, and a
 * node's title (inline only — see {@link renderToTree} and
 * `./title.ts`). They are the same language — an agent writing a fenced diff
 * into the panel and a person writing one into a note are doing the same thing
 * — and a second pipeline for any of them would be a second dialect nobody
 * asked for.
 *
 * The stages, and why each is where it is:
 *
 *   1. **parse**, with GFM — which is what brings footnotes (and tables, task
 *      lists and strikethrough) into the same dialect an agent and a reader
 *      already write.
 *   2. **to HTML**, with footnote ids left bare (`clobberPrefix: ""`). They are
 *      re-minted in step 5 against this block, so a prefix here would only be a
 *      second one to strip.
 *   3. **anchor the headings** — an `id` per heading and a link beside it
 *      pointing at it, which is what makes a section a place a reader can jump
 *      to and hand to somebody else. Before the sanitiser, not after: the id is
 *      made out of a heading somebody WROTE, so what it produces is checked by
 *      the allowlist rather than trusted for having arrived late. ./anchors.ts
 *      is that decision.
 *   4. **sanitise**, which is what makes the result safe to hand to
 *      `innerHTML`: these files are written by people, by agents and by git
 *      merges, and a note is not a place a `<script>` may appear. The allowlist
 *      is ./sanitise.ts — the security boundary, in one file, with everything
 *      this app has ever added to it named there.
 *   5. **highlight**, and then **rewrite**. Highlighting runs AFTER the
 *      sanitiser deliberately: the `hljs-` spans are ours, produced from the
 *      code's own text, so they need no allowlist entry — while `language-…`
 *      on a `<code>`, which is the reader's, is on the sanitiser's default
 *      allowlist and survives to be read here. The highlighter is
 *      `rehype-highlight`, bundled with the client: it is in `bun.lock`, so
 *      `bun.nix` fetches it into the Nix build, and no page ever asks a CDN
 *      for the code that renders someone's private outline. Which grammars it
 *      knows is a decision, made below.
 *
 * `rewrite` (./rewrite.ts) is a walk over the finished tree rather than a
 * plugin, which is what lets the pipeline be built ONCE — `rehype-highlight`
 * registers three dozen languages when it is attached, and a pipeline rebuilt
 * per note would pay for that on every row of every frame.
 *
 * A rendering is therefore two things, and both come out of one run: the HTML,
 * and the heading tree it turned out to have ({@link Rendered}). A table of
 * contents is derived from the second at view time and stored nowhere.
 *
 * Titles take one extra step after the pipeline has run: {@link toInline}
 * unwraps every block to phrasing content, so a heading or a fence that a
 * person put in a title cannot break the row's baseline layout.
 */

import nix from "highlight.js/lib/languages/nix"
import { common } from "lowlight"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeHighlight from "rehype-highlight"
import rehypeSanitize from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import type { Root } from "hast"

import { AUTOLINK } from "./anchors.ts"
import { toInline } from "./inline.ts"
import type { Heading } from "./outline.ts"
import { rewrite } from "./rewrite.ts"
import { SANITISE } from "./sanitise.ts"

/**
 * The grammars a fence may name: `lowlight`'s common set, plus Nix.
 *
 * Spelled out because the option REPLACES the default rather than adding to
 * it — `rehype-highlight` builds its lowlight from whatever `languages` says,
 * so `{ nix }` alone would be a client that had forgotten TypeScript.
 *
 * Nix is the one addition, and it is not a preference: this repository is
 * built and run through Nix, its own `docs/` are what `just serve` serves with
 * no arguments, and a ```nix fence there came out as grey text while the one
 * above it was coloured. An unregistered language is not an error — the block
 * is drawn as plain text, which is what ./render.test.ts pins — so this is the
 * difference between a fence that reads and one that merely survives.
 */
const languages = { ...common, nix }

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { clobberPrefix: "" })
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, AUTOLINK)
  .use(rehypeSanitize, SANITISE)
  .use(rehypeHighlight, { detect: false, languages })
  .use(rehypeStringify)

/** What one run of it produces: the HTML, and the headings that are in it.
 *  Not exported — the two entry points below hand out one half each, so
 *  nothing outside has to hold a pair to ask for either. */
interface Rendered {
  readonly html: string
  /** In document order, with the ids the page actually carries. */
  readonly headings: readonly Heading[]
}

/**
 * Keyed by shape, the text, AND the file it is in: the file decides where a
 * relative picture points, and shape rides the key so a title that cached a
 * full document would not poison every later note of that text.
 *
 * It earns its place at the two moments a row is rebuilt from scratch —
 * folding an ancestor and expanding it again, and every frame the live store
 * publishes. Both throw away the per-row memo and would otherwise re-run the
 * whole pipeline over text that has not changed.
 *
 * Capped rather than unbounded: an editing session rewrites notes, and every
 * intermediate version would otherwise be kept alive by its own rendering. The
 * cap is a whole-cache drop rather than an eviction policy — an LRU here would
 * be more machinery than the thing it manages.
 */
const rendered = new Map<string, Rendered>()
const CACHE_LIMIT = 512

const keyFor = (
  shape: "block" | "inline",
  from: string,
  source: string,
): string => `${shape}\n${from}\n${source}`

const renderingOf = (
  source: string,
  from: string,
  shape: "block" | "inline",
): Rendered => {
  const key = keyFor(shape, from, source)
  const hit = rendered.get(key)
  if (hit !== undefined) return hit

  const result = render(source, from, key, shape)
  if (rendered.size >= CACHE_LIMIT) rendered.clear()
  rendered.set(key, result)
  return result
}

export const renderMarkdown = (source: string, from: string): string =>
  renderingOf(source, from, "block").html

/**
 * The same pipeline as {@link renderMarkdown}, forced down to phrasing content.
 *
 * A title is one line of a tree row (or a page heading): bold, links and code
 * are welcome; a heading, a list or a fence must not introduce a block that
 * would break that layout. The words of a block stay — a fence becomes its
 * inline `<code>`, a heading becomes its text — the boxes do not. See
 * ./inline.ts.
 */
export const renderInlineMarkdown = (source: string, from: string): string =>
  renderingOf(source, from, "inline").html

/**
 * The heading tree of the same rendering — what a table of contents is made of
 * (./outline.ts), and the ONLY thing needed to make one.
 *
 * A second entry point rather than a second return value, so the page that
 * wants a contents and the component that draws the body ask their own
 * questions and neither has to hold the other's answer. They still cost one
 * run between them: both go through the memo above, on the same key.
 */
export const outlineOf = (source: string, from: string): readonly Heading[] =>
  renderingOf(source, from, "block").headings

/**
 * The same rendering, for text that is still arriving — and deliberately not
 * cached, in either direction.
 *
 * An answer streaming out of an agent is a different string every time it
 * grows, so every intermediate prefix would take a slot and none would ever be
 * asked for again: the cache would fill with half sentences and evict the notes
 * it exists for. Reading it would be no use either, since a prefix arrives once.
 *
 * How OFTEN this may be called is the caller's to manage — `chat/Entry.tsx`
 * throttles, because how often a paragraph may be re-rendered is a question
 * about the panel rather than about markdown.
 */
export const renderStreaming = (source: string, from: string): string =>
  // Same key shape as {@link renderingOf} for "block": footnote ids are minted
  // from the key, so a streamed answer and its final render must agree or
  // every `href="#md-…-fn-1"` breaks the instant streaming ends.
  render(source, from, keyFor("block", from, source), "block").html

/**
 * The sanitised HAST for a source, before stringify.
 *
 * Titles need a further walk (style `#tags`, optionally unwrap anchors) that
 * cannot run on the finished string, so they build the tree once and finish
 * it themselves. Notes and documents stay on {@link renderMarkdown}.
 */
export const renderToTree = (
  source: string,
  from: string,
  shape: "block" | "inline",
): Root => {
  const key = keyFor(shape, from, source)
  const tree = pipeline.runSync(pipeline.parse(source)) as Root
  if (shape === "inline") toInline(tree)
  rewrite(tree, { from, ids: idsFor(key) })
  return tree
}

/** Stringify a tree the pipeline already ran — titles finish their own walk. */
export const hastToHtml = (tree: Root): string => pipeline.stringify(tree)

const render = (
  source: string,
  from: string,
  key: string,
  shape: "block" | "inline",
): Rendered => {
  const tree = pipeline.runSync(pipeline.parse(source)) as Root
  if (shape === "inline") toInline(tree)
  const headings = rewrite(tree, { from, ids: idsFor(key) })
  return { html: pipeline.stringify(tree), headings }
}

/**
 * This block's id namespace, from the block itself.
 *
 * Derived rather than counted, so the same note draws the same ids on every
 * render: a frame from the live store re-renders a page, and ids that moved
 * would break every footnote link the reader had just clicked. Two DIFFERENT
 * notes get different namespaces, which is the collision that matters. Two
 * identical ones get the same — and they are the same text, so a footnote link
 * that lands in the first says exactly what the second's would have said.
 *
 * FNV-1a, because the only property needed is "different inputs, different
 * strings, cheaply". Nothing here is security, and the sanitiser is not
 * relying on it.
 */
const idsFor = (key: string): string => {
  let hash = 0x811c9dc5
  for (let at = 0; at < key.length; at++) {
    hash ^= key.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return `md-${(hash >>> 0).toString(36)}`
}
