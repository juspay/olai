/**
 * A node's title, as safe HTML.
 *
 * Two view-time concerns that belong together because they share one string:
 * the title is stored verbatim, and both the markdown and the `#tags` in it
 * are decided only when it is drawn. One function answers both, so a tree row
 * and a zoomed heading cannot disagree about either.
 *
 * There are three ways it can answer, and which one a title gets is the whole
 * of how an outline paints before the markdown machinery has arrived:
 *
 *   1. **plain** — the title has no markdown in it at all (./plain.ts), so it
 *      is words and tags and the answer is immediate. Nearly every title.
 *   2. **rendered** — it does have markdown, and ./pipeline.ts is here.
 *   3. **the source, escaped** — it has markdown and the pipeline is still on
 *      its way. What is drawn is what the person wrote, marks and all, and the
 *      memo that asked is re-run when the chunk lands (./chunk.ts). One line
 *      of text either way: nothing moves on the page but the marks.
 *
 * Ordering matters within (2), and it is the reverse of what it used to be:
 *
 *   1. **inline markdown first** — same pipeline a note uses, forced to
 *      phrasing content (`renderToTree` + `toInline`).
 *   2. **then `#tags`** — walk the finished HAST and style tags in text nodes,
 *      skipping `code` and `a` so a tag inside code stays code and a URL
 *      fragment is not mistaken for a tag (./tags.ts).
 *
 * Peeling tags *before* markdown would split constructs across two parser runs
 * (`**urgent #home**` loses its bold; `[spec](…#home)` shreds the link). Tags
 * after markdown keeps every construct whole.
 *
 * When the pipeline loses text the source still accounts for — empty render
 * of non-empty source, or a shorter plain-text estimate after stripping
 * markdown marks (`Use <Component> here` → `Use  here`) — fall back to the
 * escaped source. A title that looks correct while missing a word is worse
 * than the marks. The fallback is plain escaped text (no tag styling): it is
 * "show what you wrote", not a second render path.
 *
 * A FILTERED PAGE HANDS DOWN ITS NEEDLES, and they ride both of the first two
 * answers rather than one: the words a query found this node by are wrapped
 * where they sit (`../filter/lit.ts`), so a row says which part of its title
 * put it in front of the reader. The third answer draws none — escaped source
 * is the "show what you wrote" fallback, and marking it up is exactly what it
 * is refusing to do.
 */

import type { Element, ElementContent, Root, RootContent, Text } from "hast"

import { NO_NEEDLES } from "../filter/lit.ts"
import { markdownReady } from "./chunk.ts"
import { plainTitle } from "./plain.ts"
import { hastToHtml, renderToTree } from "./render.ts"
import { escapeHtml, styleTags } from "./tags.ts"

export interface TitleRender {
  /** When false, markdown links are unwrapped to their children so the title
   *  can sit inside an existing `<a>` (breadcrumb, see-ref) without nesting. */
  readonly links?: boolean
  /**
   * The words a filter found this node by, lit inside the title
   * (../filter/lit.ts) — empty, which is every title on an unfiltered page.
   *
   * The one option that is not a property of the title: it is a fact about the
   * PAGE, handed down so a row can say why it is in front of somebody. Which
   * is also why a highlighted title is not remembered below.
   */
  readonly needles?: ReadonlyArray<string>
}

/**
 * Titles have their own caches: short, numerous, long-lived — a different
 * population from notes, and one that would thrash the note cache at ~500 rows
 * if they shared the 512-slot map. TWO of them, because a plain title and a
 * rendered one are different populations again:
 *
 *   - a PLAIN title (./plain.ts) depends on nothing but the title, so it is
 *     keyed on the title alone and the same words in a row, a breadcrumb and a
 *     see-ref are one entry rather than three;
 *   - a RENDERED one depends on the file it is in (relative pictures) and on
 *     whether its links survive, so it is keyed on all three.
 *
 * Separate maps rather than one, because the caps are what they are for: plain
 * titles are ~99% of them and cost a few regexes, and letting them fill a
 * shared map would drop the handful of pipeline renders — the expensive
 * ones — on every clear.
 */
const plainTitles = new Map<string, string>()
const rendered = new Map<string, string>()
const CACHE_LIMIT = 1024

/** One title → one HTML string, safe for `innerHTML`. */
export const renderTitle = (
  title: string,
  from: string,
  options: TitleRender = {},
): string => {
  const needles = options.needles ?? NO_NEEDLES
  // A HIGHLIGHTED TITLE IS DRAWN RATHER THAN REMEMBERED, and that is the cache
  // saying no rather than the feature paying nothing. Its key would have to
  // hold the query, which changes on every keystroke — so every row of a
  // filtered page would mint an entry nobody asks for twice, and the handful of
  // expensive pipeline renders in the map beside it would be cleared to make
  // room for them. What it costs is what it was always going to cost: a
  // filtered page is a small page, and the memo that asked re-runs per
  // keystroke either way.
  if (needles.length > 0) return lit(title, from, options.links !== false, needles)

  const wasPlain = plainTitles.get(title)
  if (wasPlain !== undefined) return wasPlain
  const plain = plainTitle(title)
  if (plain !== null) return remember(plainTitles, title, plain)

  const links = options.links !== false
  const key = `${links ? "a" : "n"}\n${from}\n${title}`
  const hit = rendered.get(key)
  if (hit !== undefined) return hit

  // Not cached: this is what the title looks like WHILE the chunk is coming,
  // and a cache is exactly the thing that would still be handing it out
  // afterwards. The read is what re-runs the caller's memo when it lands.
  if (!markdownReady()) return escapeHtml(title)

  return remember(rendered, key, build(title, from, links, NO_NEEDLES))
}

/** The same three answers, with the query's words lit and nothing kept — the
 *  order above, minus the two lookups it exists to skip. */
const lit = (
  title: string,
  from: string,
  links: boolean,
  needles: ReadonlyArray<string>,
): string => {
  const plain = plainTitle(title, needles)
  if (plain !== null) return plain
  if (!markdownReady()) return escapeHtml(title)
  return build(title, from, links, needles)
}

const remember = (
  cache: Map<string, string>,
  key: string,
  html: string,
): string => {
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, html)
  return html
}

const build = (
  title: string,
  from: string,
  links: boolean,
  needles: ReadonlyArray<string>,
): string => {
  const tree = renderToTree(title, from, "inline")
  styleTags(tree, needles)
  if (!links) unwrapAnchors(tree)

  // The pipeline dropped words the source still accounts for — fully empty,
  // or shorter than the source with markdown marks removed (raw HTML content
  // is kept in the estimate, so `Use <Component> here` fails the length check
  // when the pipeline leaves only "Use  here").
  if (title.trim() !== "" && lostText(title, tree)) {
    return escapeHtml(title)
  }
  return hastToHtml(tree)
}

/** True when the rendered plain text is missing content the source still has. */
const lostText = (title: string, tree: Root): boolean => {
  const rendered = collapse(textOf(tree))
  const expected = collapse(plainTextEstimate(title))
  if (rendered === "") return true
  return rendered.length < expected.length
}

/**
 * Rough plain text a title should still show after markdown is interpreted:
 * link labels, code bodies, emphasis bodies kept; markers stripped. Angle
 * brackets and their contents are KEPT — raw HTML is what the pipeline drops
 * and what the length check is for. Autolinks `<http…>` are the one
 * angle-bracket form that is markdown, and are unwrapped to the URL.
 */
const plainTextEstimate = (source: string): string => {
  let s = source
  s = s.replace(/```[^\n]*\n?([\s\S]*?)```/g, "$1")
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  s = s.replace(/<(https?:\/\/[^>]+)>/g, "$1")
  s = s.replace(/`([^`]+)`/g, "$1")
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1")
  s = s.replace(/__([^_]+)__/g, "$1")
  s = s.replace(/~~([^~]+)~~/g, "$1")
  s = s.replace(/\*([^*]+)\*/g, "$1")
  // Emphasis underscores only when not mid-tag (`#a_b` stays).
  s = s.replace(/(^|[\s(])_([^_]+)_([\s).,!?:;]|$)/g, "$1$2$3")
  s = s.replace(/^#{1,6}\s+/gm, "")
  s = s.replace(/^[-*+]\s+/gm, "")
  s = s.replace(/^([-*_])\1{2,}\s*$/gm, "")
  s = s.replace(/\[\^[^\]]+\]/g, "")
  s = s.replace(/^\[\^[^\]]+\]:\s*.*$/gm, "")
  return s
}

const collapse = (value: string): string => value.replace(/\s+/g, " ").trim()

/** Lift every `<a>` to its children so a title inside a Link has no nested
 *  anchors. Recurses first so nested structure is flattened cleanly. */
const unwrapAnchors = (parent: Root | Element): void => {
  const next: ElementContent[] = []
  for (const child of parent.children) {
    if (child.type !== "element") {
      if (child.type === "text") next.push(child)
      continue
    }
    unwrapAnchors(child)
    if (child.tagName === "a") {
      next.push(...(child.children as ElementContent[]))
    } else {
      next.push(child)
    }
  }
  parent.children = next as typeof parent.children
}

const textOf = (tree: Root): string => {
  let out = ""
  const walk = (nodes: ReadonlyArray<RootContent | ElementContent>): void => {
    for (const node of nodes) {
      if (node.type === "text") out += (node as Text).value
      else if (node.type === "element") walk(node.children)
    }
  }
  walk(tree.children)
  return out
}
