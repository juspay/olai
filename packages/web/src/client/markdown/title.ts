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
 *      fragment is not mistaken for a tag. The alphabet is
 *      {@link titleTagRe} from `@olai/format` — the client does not re-declare
 *      it.
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
 */

import { titleTagRe } from "@olai/format"
import type { Element, ElementContent, Root, RootContent, Text } from "hast"

import { TESTID } from "../testids.ts"
import { hastToHtml, renderToTree } from "./render.ts"

/**
 * The class a styled tag wears. A complete string literal so Tailwind's content
 * scan still finds both utilities when the markup is built as HTML rather than
 * as a Solid element.
 */
const TAG_CLASS = "font-semibold text-accent"

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
  }
  parent.children = next as typeof parent.children
}

const splitTags = (text: string): ElementContent[] => {
  const parts: ElementContent[] = []
  let at = 0
  // Fresh regex from @olai/format — the alphabet is one place, not two.
  for (const match of text.matchAll(titleTagRe())) {
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

/** Escape for the loss fallback. The alphabet of a real title can hold `<`,
 *  so this is the one place raw source may reach `innerHTML`. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
