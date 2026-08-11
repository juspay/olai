/**
 * A node's title, as safe HTML.
 *
 * Two view-time concerns that belong together because they share one string:
 * the title is stored verbatim, and both the markdown and the `#tags` in it
 * are decided only when it is drawn. One function answers both, so a tree row
 * and a zoomed heading cannot disagree about either.
 *
 * Ordering matters, and it is the reverse of what it used to be:
 *
 *   1. **inline markdown first** — same pipeline a note uses, forced to
 *      phrasing content (`renderToTree` + `toInline`).
 *   2. **then `#tags`** — walk the finished HAST and style tags in text nodes,
 *      skipping `code` and `a` so a tag inside code stays code and a URL
 *      fragment is not mistaken for a tag.
 *
 * Peeling tags *before* markdown would split constructs across two parser runs
 * (`**urgent #home**` loses its bold; `[spec](…#home)` shreds the link). Tags
 * after markdown keeps every construct whole.
 *
 * When the pipeline produces no text but the source had some (`---`, a bare
 * `<div>…</div>`), fall back to the escaped source: an empty title is an
 * unlabelled row, which is worse than showing the marks.
 */

import type { Element, ElementContent, Root, RootContent, Text } from "hast"

import { TESTID } from "../testids.ts"
import { hastToHtml, renderToTree } from "./render.ts"

/**
 * The class a styled tag wears. A complete string literal so Tailwind's content
 * scan still finds both utilities when the markup is built as HTML rather than
 * as a Solid element.
 */
const TAG_CLASS = "font-semibold text-accent"

/** Same alphabet as `@olai/format`'s `titleParts` — keep them in step. */
const TAG = /#[A-Za-z0-9_/-]+/g

/** Subtrees where a `#…` sequence is not a tag: code is code, a link's text
 *  and href are not re-parsed for tags (a URL fragment is the sharpest case). */
const SKIP_TAGS = new Set(["code", "a"])

export interface TitleRender {
  /** When false, markdown links are unwrapped to their children so the title
   *  can sit inside an existing `<a>` (breadcrumb, see-ref) without nesting. */
  readonly links?: boolean
}

/** Titles have their own cache: short, numerous, long-lived — a different
 *  population from notes, and one that would thrash the note cache at ~500
 *  rows if they shared the 512-slot map. */
const titles = new Map<string, string>()
const TITLE_CACHE_LIMIT = 1024

/** One title → one HTML string, safe for `innerHTML`. */
export const renderTitle = (
  title: string,
  from: string,
  options: TitleRender = {},
): string => {
  const links = options.links !== false
  const key = `${links ? "a" : "n"}\n${from}\n${title}`
  const hit = titles.get(key)
  if (hit !== undefined) return hit

  const html = build(title, from, links)
  if (titles.size >= TITLE_CACHE_LIMIT) titles.clear()
  titles.set(key, html)
  return html
}

const build = (title: string, from: string, links: boolean): string => {
  const tree = renderToTree(title, from, "inline")
  styleTags(tree)
  if (!links) unwrapAnchors(tree)

  // Empty render of non-empty source: the pipeline dropped everything (a
  // thematic break, raw HTML that remark never promotes, a footnote def).
  // An unlabelled row is worse than the marks; show the escaped source.
  if (textOf(tree).trim() === "" && title.trim() !== "") {
    return escapeHtml(title)
  }
  return hastToHtml(tree)
}

/** Walk text nodes and turn `#tags` into styled spans. */
const styleTags = (tree: Root): void => {
  walkTags(tree)
}

const walkTags = (parent: Root | Element): void => {
  const next: ElementContent[] = []
  for (const child of parent.children) {
    if (child.type === "text") {
      next.push(...splitTags(child.value))
      continue
    }
    if (child.type === "element") {
      if (!SKIP_TAGS.has(child.tagName)) walkTags(child)
      next.push(child)
      continue
    }
    // comments / doctype: drop for a title (nothing to show)
  }
  parent.children = next as typeof parent.children
}

const splitTags = (text: string): ElementContent[] => {
  const parts: ElementContent[] = []
  let at = 0
  for (const match of text.matchAll(TAG)) {
    const start = match.index
    if (start > at) parts.push({ type: "text", value: text.slice(at, start) })
    const name = match[0].slice(1)
    parts.push({
      type: "element",
      tagName: "span",
      properties: {
        className: TAG_CLASS.split(" "),
        dataTestid: TESTID.tag,
      },
      children: [{ type: "text", value: `#${name}` }],
    })
    at = start + match[0].length
  }
  if (at < text.length) parts.push({ type: "text", value: text.slice(at) })
  return parts.length > 0 ? parts : text.length > 0 ? [{ type: "text", value: text }] : []
}

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

/** Escape for the empty-render fallback. The alphabet of a real title can
 *  hold `<`, so this is the one place raw source may reach `innerHTML`. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
