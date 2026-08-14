/**
 * `#tags` in a title, styled.
 *
 * A view-time split, like the markdown around it: the title is stored verbatim
 * and what is a tag is decided only when it is drawn. WHERE a tag starts and
 * stops is `titleParts` from `@olai/format` — the same walk the search index
 * asks for its tag facet — so the client neither re-declares the alphabet nor
 * re-derives the boundaries. What is here is only what a tag LOOKS like.
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

import { mayHoldTag, tagText, titleParts } from "@olai/format"
import type { Element, ElementContent, Root } from "hast"

import { TAG_ATTRIBUTE } from "../filter/tag.ts"
import { TESTID } from "../testids.ts"

/**
 * The class a styled tag wears — the Workflowy-exact pill (#102): a subtle
 * rounded chip, not bold accent text.
 *
 * A complete string literal so Tailwind's content scan still finds every
 * utility when the markup is built as HTML rather than as a Solid element.
 *
 * It is PRESSABLE now — the pointer and the hover say so — because a click on
 * one filters the page to it (`../filter/tag.ts`). That is the promise
 * title-markdown deliberately withheld while the tags were decorative, and the
 * cursor is how a reader is told it has arrived.
 */
export const TAG_CLASS =
  "mx-0.5 inline-block max-w-full cursor-pointer rounded-sm bg-accent/15 px-1 py-px text-[0.8125rem] font-normal leading-snug text-accent hover:bg-accent/25"

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

/** One run of text, as the text and pills it turns out to be — guarded by the
 *  format's own cheap negative, exactly as the HTML path below and the search
 *  index are, because a HAST walk asks this per TEXT NODE and most of them hold
 *  no sigil at all. */
const splitTags = (text: string): ElementContent[] => {
  if (!mayHoldTag(text)) return [{ type: "text", value: text } as ElementContent]
  return titleParts(text).map((part) =>
    part.kind === "tag"
      ? pill(tagText(part))
      : ({ type: "text", value: part.text } as ElementContent),
  )
}

/** The same text and the same pills, written straight to HTML — no tree, and
 *  so no stringifier to wait for. */
export const taggedHtml = (text: string): string => {
  if (!mayHoldTag(text)) return escapeText(text)
  return titleParts(text)
    .map((part) => {
      if (part.kind !== "tag") return escapeText(part.text)
      // AS WRITTEN in both places: the text a reader sees, and the value the
      // delegated press filters by. `titleParts` restricts a tag's alphabet
      // (`isTagName`), so the attribute cannot carry a quote — and `escapeText`
      // is applied anyway rather than reasoned about at each call.
      const written = escapeText(tagText(part))
      return `<span class="${TAG_CLASS}" data-testid="${TESTID.tag}" ${TAG_ATTRIBUTE}="${written}">${written}</span>`
    })
    .join("")
}

/** The pill, over the tag AS WRITTEN — sigil and all, because that is what the
 *  title says, what a reader searches for, and what a press filters by. */
const pill = (written: string): Element => ({
  type: "element",
  tagName: "span",
  properties: {
    className: TAG_CLASS.split(" "),
    dataTestid: TESTID.tag,
    dataTag: written,
  },
  children: [{ type: "text", value: written }],
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
