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
 *
 * THE QUERY'S WORDS ARE LIT ON THE SAME TWO PATHS, and they had to be: a
 * filtered row that highlighted its hit on the fast path and not on the other
 * would light up nearly every title in the app and quietly miss the ones with
 * markdown in them. So the needles ride through both walks and are wrapped by
 * one split (`../filter/lit.ts`) — text and tags alike, since a `#tag` typed
 * into the box is exactly the hit a reader most needs to see.
 */

import { mayHoldTag, tagText, titleParts } from "@olai/format"
import type { Element, ElementContent, Root } from "hast"

import { HIT_CLASS, NO_NEEDLES, runsOf } from "../filter/lit.ts"
import { TAG_ATTRIBUTE } from "../filter/tag.ts"
import { TESTID } from "../testids.ts"

/**
 * The class a styled tag wears.
 *
 * IT IS NOT A PILL ANY MORE (the quiet outline, human). It was a rounded chip in
 * accent ink on an accent wash (#102, Workflowy-exact), and on a vault where
 * every third title carries two of them that is a line of boxes with words in
 * between: the tag stopped being an annotation on the title and became the
 * loudest thing in the row.
 *
 * The ruling is that tags stay INLINE, exactly where they are written, and are
 * quieted by CONTRAST rather than by a container — dim ink, no background, no
 * border, no radius, nothing to move them out of the sentence. They BRIGHTEN on
 * hover and while the row is open, which is the whole of their affordance: a tag
 * you are pointing at, or a row you have opened, is a tag you are about to use.
 *
 * `olai-tag` is here for that: the states are keyed on the row's TITLE SPAN
 * (`../NodeLine.tsx`'s `TITLE_OPEN`), which no inline utility can express, so
 * the ink and its two brightenings live in `../styles.css` beside the pointer
 * rule that was already there. What stays in the utilities is the geometry.
 *
 * `whitespace-nowrap` is not tidiness: a tag is ONE token, and rendered markdown
 * breaks words anywhere (`../styles.css`'s `.olai-md`) so that a pasted URL
 * cannot widen a column. Without this, a row whose title ellipsizes broke
 * `#design` after the sigil and dropped `design` onto a second line — the tag
 * has to be one thing or be clipped, never half of each.
 *
 * A complete string literal so Tailwind's content scan still finds every utility
 * when the markup is built as HTML rather than as a Solid element.
 *
 * WHETHER IT IS PRESSABLE IS NOT DECIDED HERE, and it cannot be: a title is
 * drawn on pages that can carry a filter and on pages that cannot (a day, the
 * agenda, a document), and this function is handed a string rather than a
 * route. The pointer and the hover live in `../styles.css`, keyed on the pane
 * saying it is narrowable — so a tag on a day page looks exactly as decorative
 * as it behaves. `../filter/tag.ts` declines the click on the same condition,
 * and the two are one fact spelled in one place (`App.tsx`).
 */
export const TAG_CLASS =
  "olai-tag inline whitespace-nowrap text-[0.8125rem] font-normal leading-snug"

/** Subtrees where a `#…` sequence is not a tag: code is code, a link's text
 *  and href are not re-parsed for tags (a URL fragment is the sharpest case). */
const SKIP_TAGS = new Set(["code", "a"])

/** Walk text nodes and turn `#tags` into styled spans — and, where the page
 *  is filtered, the query's words into marks (../filter/lit.ts). */
export const styleTags = (
  parent: Root | Element,
  needles: ReadonlyArray<string> = NO_NEEDLES,
): void => {
  const next: ElementContent[] = []
  for (const child of parent.children) {
    if (child.type === "text") {
      next.push(...splitTags(child.value, needles))
      continue
    }
    if (child.type === "element") {
      if (!SKIP_TAGS.has(child.tagName)) styleTags(child, needles)
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
const splitTags = (
  text: string,
  needles: ReadonlyArray<string>,
): ElementContent[] => {
  if (!mayHoldTag(text)) return marked(text, needles)
  return titleParts(text).flatMap((part) =>
    part.kind === "tag"
      ? [pill(tagText(part), needles)]
      : marked(part.text, needles),
  )
}

/** One run of ordinary text as the content it becomes: itself, or itself with
 *  the query's words wrapped in marks. */
const marked = (
  text: string,
  needles: ReadonlyArray<string>,
): ElementContent[] => {
  // The unfiltered shape, which is every title this app draws until somebody
  // types: one text node, no run list to walk and throw away. Guarded here
  // rather than in `runsOf` because the split is what that function IS.
  if (needles.length === 0) return [{ type: "text", value: text } as ElementContent]
  return runsOf(text, needles).map((run) =>
    run.lit ? mark(run.text) : ({ type: "text", value: run.text } as ElementContent),
  )
}

const mark = (text: string): Element => ({
  type: "element",
  tagName: "mark",
  properties: { className: [HIT_CLASS], dataTestid: TESTID.hit },
  children: [{ type: "text", value: text }],
})

/** The same text and the same pills, written straight to HTML — no tree, and
 *  so no stringifier to wait for. */
export const taggedHtml = (
  text: string,
  needles: ReadonlyArray<string> = NO_NEEDLES,
): string => {
  if (!mayHoldTag(text)) return markedHtml(text, needles)
  return titleParts(text)
    .map((part) => {
      if (part.kind !== "tag") return markedHtml(part.text, needles)
      // AS WRITTEN in both places: the text a reader sees, and the value the
      // delegated press filters by — ONE binding, so the attribute and the
      // words inside the pill cannot be produced by two expressions that must
      // agree. `titleParts` restricts a tag's alphabet (`isTagName`), so the
      // attribute cannot carry a quote — and `escapeText` is applied anyway
      // rather than reasoned about at each call.
      const written = tagText(part)
      return `<span class="${TAG_CLASS}" data-testid="${TESTID.tag}" ${TAG_ATTRIBUTE}="${
        escapeText(written)
      }">${markedHtml(written, needles)}</span>`
    })
    .join("")
}

/** The same runs {@link marked} makes, written straight to HTML — and the
 *  `<mark>` has to stringify EXACTLY as `hast-util-to-html` writes the element
 *  above, which is what ./plain.test.ts holds the two paths to. */
const markedHtml = (text: string, needles: ReadonlyArray<string>): string => {
  // {@link marked}'s guard, one path over — the same reason, and the same
  // bytes it used to write before there was a query to answer.
  if (needles.length === 0) return escapeText(text)
  return runsOf(text, needles)
    .map((run) =>
      run.lit
        ? `<mark class="${HIT_CLASS}" data-testid="${TESTID.hit}">${
          escapeText(run.text)
        }</mark>`
        : escapeText(run.text),
    )
    .join("")
}

/** The pill, over the tag AS WRITTEN — sigil and all, because that is what the
 *  title says, what a reader searches for, and what a press filters by. */
const pill = (
  written: string,
  needles: ReadonlyArray<string>,
): Element => ({
  type: "element",
  tagName: "span",
  properties: {
    className: TAG_CLASS.split(" "),
    dataTestid: TESTID.tag,
    dataTag: written,
  },
  // A PILL IS LIT LIKE ANY OTHER TEXT — `#deferral` typed into the box, or
  // pressed, lands on the tag itself, and a row that lit every word but the one
  // the reader clicked would be the row not answering the question.
  children: marked(written, needles),
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
