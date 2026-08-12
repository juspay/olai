/**
 * `#tags` in a title, styled.
 *
 * A view-time split, like the markdown around it: the title is stored verbatim
 * and what is a tag is decided only when it is drawn. The alphabet is
 * {@link titleTagRe} from `@olai/format` — the client does not re-declare it —
 * and the boundary decision (where a tag starts and stops) is made once, in
 * {@link splitTags}, so nothing that draws a title can disagree about it.
 *
 * Two renderings of the same pill live here, and they must agree:
 *
 *   - {@link styleTags}, which walks the HAST a title's markdown produced and
 *     replaces tags inside its text nodes (./title.ts's path, for a title that
 *     turned out to have markdown in it);
 *   - {@link taggedHtml}, which writes the same pill straight to HTML for a
 *     title that has no markdown at all (./plain.ts) — the common case, and
 *     the one that must not wait for a parser to arrive.
 *
 * They are side by side because they are one decision, and `./plain.test.ts`
 * holds them to each other by rendering the same titles both ways.
 */

import { titleTagRe } from "@olai/format"
import type { Element, ElementContent, Root } from "hast"

import { TESTID } from "../testids.ts"

/**
 * The class a styled tag wears. A complete string literal so Tailwind's content
 * scan still finds both utilities when the markup is built as HTML rather than
 * as a Solid element.
 */
// Workflowy-exact tag pill (#102): subtle rounded chip, not bold accent text.
// Complete string literal so Tailwind's content scan still finds every utility
// when the markup is built as HTML rather than as a Solid element.
export const TAG_CLASS =
  "mx-0.5 inline-block max-w-full rounded-sm bg-accent/15 px-1 py-px text-[0.8125rem] font-normal leading-snug text-accent"

/** Subtrees where a `#…` sequence is not a tag: code is code, a link's text
 *  and href are not re-parsed for tags (a URL fragment is the sharpest case). */
const SKIP_TAGS = new Set(["code", "a"])

/** Walk text nodes and turn `#tags` into styled spans. */
export const styleTags = (parent: Root | Element): void => {
  const next: ElementContent[] = []
  for (const child of parent.children) {
    if (child.type === "text") {
      next.push(...splitTags(child.value))
      continue
    }
    if (child.type === "element") {
      if (!SKIP_TAGS.has(child.tagName)) styleTags(child)
      next.push(child)
      continue
    }
  }
  parent.children = next as typeof parent.children
}

/** One run of text, as the text and pills it turns out to be. */
export const splitTags = (text: string): ElementContent[] => {
  const parts: ElementContent[] = []
  let at = 0
  // Fresh regex from @olai/format — the alphabet is one place, not two.
  for (const match of text.matchAll(titleTagRe())) {
    const start = match.index
    if (start > at) parts.push({ type: "text", value: text.slice(at, start) })
    parts.push(pill(match[0].slice(1)))
    at = start + match[0].length
  }
  if (at < text.length) parts.push({ type: "text", value: text.slice(at) })
  return parts.length > 0 ? parts : text.length > 0 ? [{ type: "text", value: text }] : []
}

/** The same text and the same pills, written straight to HTML — no tree, and
 *  so no stringifier to wait for. */
export const taggedHtml = (text: string): string => {
  let html = ""
  let at = 0
  for (const match of text.matchAll(titleTagRe())) {
    const start = match.index
    if (start > at) html += escapeText(text.slice(at, start))
    html += `<span class="${TAG_CLASS}" data-testid="${TESTID.tag}">${escapeText(match[0])}</span>`
    at = start + match[0].length
  }
  return html + escapeText(text.slice(at))
}

const pill = (name: string): Element => ({
  type: "element",
  tagName: "span",
  properties: {
    className: TAG_CLASS.split(" "),
    dataTestid: TESTID.tag,
  },
  children: [{ type: "text", value: `#${name}` }],
})

/**
 * Text, escaped EXACTLY the way `hast-util-to-html` escapes it: the two
 * characters in its subset, `&` and `<`, and each written as the numeric
 * reference it writes rather than the named one a person would.
 *
 * That precision is the point, and neither half of it is a preference.
 * ./plain.ts writes a title's words to HTML without the pipeline, and its
 * whole claim is that the bytes are the ones the pipeline would have written —
 * so a `"` escaped here that is left alone there, or an `&amp;` where it says
 * `&#x26;`, is a difference. Both were found by ./plain.test.ts rather than by
 * reading, which is the argument for that sweep existing.
 *
 * A title ./plain.ts accepts can hold no `<` at all, so that half is belt as
 * well as braces on the one path where a title's own text reaches `innerHTML`
 * with no sanitiser between.
 */
export const escapeText = (value: string): string =>
  value.replace(/&/g, "&#x26;").replace(/</g, "&#x3C;")

/**
 * Text, escaped for a fallback — the two in ./title.ts, and the file's own
 * source in ./Markdown.tsx.
 *
 * Wider than {@link escapeText} because it is a different job: this one takes
 * SOURCE, which is exactly the string that may hold a `<b>` or a `"` somebody
 * wrote, and it is claiming nothing about what a pipeline would have made of
 * it. Showing what was written, safely, is the whole promise.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
