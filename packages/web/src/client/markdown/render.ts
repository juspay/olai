/**
 * Markdown, rendered.
 *
 * Markdown is interpreted only at view time; the text on disk stays verbatim,
 * so this is a pure function from a string in a file to HTML — no caching
 * layer on disk, no pre-rendered field in a record, nothing that could go
 * stale. One pipeline serves every piece of markdown this app draws: a node's
 * note, a whole `.md` document, what the agent says in the chat panel, and a
 * node's title (inline only — see {@link renderInlineMarkdown}). They are the
 * same language — an agent writing a fenced diff into the panel and a person
 * writing one into a note are doing the same thing — and a second pipeline for
 * any of them would be a second dialect nobody asked for.
 *
 * The stages, and why each is where it is:
 *
 *   1. **parse**, with GFM — which is what brings footnotes (and tables, task
 *      lists and strikethrough) into the same dialect an agent and a reader
 *      already write.
 *   2. **to HTML**, with footnote ids left bare (`clobberPrefix: ""`). They are
 *      re-minted in step 4 against this block, so a prefix here would only be a
 *      second one to strip.
 *   3. **sanitise**, which is what makes the result safe to hand to
 *      `innerHTML`: these files are written by people, by agents and by git
 *      merges, and a note is not a place a `<script>` may appear. Clobbering is
 *      off for the same reason as above — every id on the page is minted in
 *      step 4, which is a stronger rule than a shared prefix.
 *   4. **highlight**, and then **rewrite**. Highlighting runs AFTER the
 *      sanitiser deliberately: the `hljs-` spans are ours, produced from the
 *      code's own text, so they need no allowlist entry — while `language-…`
 *      on a `<code>`, which is the reader's, is on the sanitiser's default
 *      allowlist and survives to be read here. The highlighter is
 *      `rehype-highlight`, bundled with the client: it is in `bun.lock`, so
 *      `bun.nix` fetches it into the Nix build, and no page ever asks a CDN
 *      for the code that renders someone's private outline.
 *
 * `rewrite` (./rewrite.ts) is a walk over the finished tree rather than a
 * plugin, which is what lets the pipeline be built ONCE — `rehype-highlight`
 * registers three dozen languages when it is attached, and a pipeline rebuilt
 * per note would pay for that on every row of every frame.
 *
 * Titles take one extra step after the pipeline has run: {@link toInline}
 * unwraps every block to phrasing content, so a heading or a fence that a
 * person put in a title cannot break the row's baseline layout.
 */

import rehypeHighlight from "rehype-highlight"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import type { Root } from "hast"

import { toInline } from "./inline.ts"
import { rewrite } from "./rewrite.ts"

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { clobberPrefix: "" })
  .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: "" })
  .use(rehypeHighlight, { detect: false })
  .use(rehypeStringify)

/**
 * Keyed by the text AND the file it is in, because both are the input: the
 * file decides where a relative picture points, so the same paragraph in two
 * outlines is two renderings.
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
const rendered = new Map<string, string>()
const CACHE_LIMIT = 512

export const renderMarkdown = (source: string, from: string): string =>
  cached(source, from, "block")

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
  cached(source, from, "inline")

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
  render(source, from, `${from}\n${source}`, "block")

const cached = (
  source: string,
  from: string,
  shape: "block" | "inline",
): string => {
  // Shape rides the key: the same source is two renderings, and a title that
  // cached a full document would poison every later note of that text.
  const key = `${shape}\n${from}\n${source}`
  const hit = rendered.get(key)
  if (hit !== undefined) return hit

  const html = render(source, from, key, shape)
  if (rendered.size >= CACHE_LIMIT) rendered.clear()
  rendered.set(key, html)
  return html
}

const render = (
  source: string,
  from: string,
  key: string,
  shape: "block" | "inline",
): string => {
  const tree = pipeline.runSync(pipeline.parse(source)) as Root
  if (shape === "inline") toInline(tree)
  rewrite(tree, { from, ids: idsFor(key) })
  return pipeline.stringify(tree)
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
