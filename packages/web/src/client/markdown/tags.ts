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
 *
 * ONLY ONE OF THE TWO CARRIES {@link NO_TAGS_IN}, and that is not an asymmetry
 * to fix. A code span or a link is markdown, and ./plain.ts refuses every
 * title holding a backtick or a bracket — so the HTML path cannot meet either
 * and needs no rule about them. If that ever stops being true, the fast path
 * has widened, and ./plain.test.ts's sweep is what says so.
 */

import { litBy, type Lit, mayHoldTag, tagText, titleParts } from "@olai/format"
import type { Element, ElementContent, Root } from "hast"

import { HIT_CLASS, NO_NEEDLES, runsIn } from "../filter/lit.ts"
import { TAG_ATTRIBUTE } from "../filter/tag.ts"
import { TESTID } from "../testids.ts"
import { isAnchor } from "./anchors.ts"

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

/**
 * Subtrees where a `#…` sequence is not a tag: code is code, and a link's text
 * is not re-parsed for tags (a URL fragment is the sharpest case).
 *
 * THE WALK STILL GOES IN. It used to turn back at the door, and the highlight
 * — which rides the same walk — turned back with it: a needle living ONLY
 * inside a title's `code` span or link selected the row and lit nothing (grok,
 * #240), because the one place nobody looks for tags was also the one place
 * nobody lit. That was two claims traveling as one, and only the first was
 * ever argued for. They are two things now: the walk descends everywhere and
 * the query's words are marked wherever they sit, while this set turns THE TAG
 * SPLIT off under it — a `#` in a URL fragment is still not a tag, and a `#`
 * in code is still code.
 *
 * How that reaches a subtree rather than one element is {@link tagsIn}.
 */
const NO_TAGS_IN = new Set(["code", "a"])

/**
 * Whether a `#…` written in this element's text is a tag.
 *
 * `outer` is the answer for the text AROUND it, and the `&&` is the whole of
 * why {@link NO_TAGS_IN} covers a SUBTREE: literalness only ever accumulates
 * on the way down, so a `<code>` inside an `<a>` is as literal as either and
 * nothing below one can win its tags back.
 *
 * Its own function, and not the traversal's business: this is a question about
 * markup — asked of one element and the answer it inherited — and the walk
 * below is a question about a tree. Sharing a line was how the two got
 * confused in the first place.
 */
const tagsIn = (element: Element, outer: boolean): boolean =>
  outer && !NO_TAGS_IN.has(element.tagName)

/**
 * Walk text nodes and turn `#tags` into styled spans — and, where the page is
 * filtered, the query's words into marks (../filter/lit.ts).
 *
 * The seed is `true` and is not a parameter: a title's own text is prose, and
 * literalness is something the markup UNDER it can only take away. A caller
 * that could ask for a whole title to be read as code would be a second answer
 * to a question the markdown has already answered.
 *
 * THE QUERY IS LOOKED FOR ONCE, over the concatenated `.value` of every text
 * node in document order — the title as the reader sees it, markdown syntax
 * skipped. Each node is then a WINDOW onto that one search, the same contract
 * `titleParts` already has for a phrase that spans a `#tag`. Searching each
 * node on its own is what left `"check before"` dark across a code-span
 * boundary: the phrase is in neither piece.
 *
 * Source `position` already survives the pipeline for ordinary phrasing. It is
 * a check, not the map: inline-code offsets include the backticks, and
 * `toInline` clones a pretty-print `\n` with no position at all. Mapping by
 * concatenation does not need the field. `bracketSpacedLinks` (in ./pipeline.ts)
 * rewrites `[label](dest with spaces)` to a different length before parse, so
 * a future source-offset map would have to run the same rewrite; this walk
 * never asks.
 */
export const styleTags = (
  parent: Root | Element,
  needles: ReadonlyArray<string> = NO_NEEDLES,
): void => {
  const records: Slot[] = []
  visitText(parent, true, records)
  const haystack = records.map((slot) => slot.value).join("")
  const landed = litBy(haystack, needles)

  const replacements = new Map<Root | Element, Map<number, ElementContent[]>>()
  let at = 0
  for (const rec of records) {
    const to = at + rec.value.length
    const nodes = splitTags(haystack, landed, at, to, rec.tags)
    let slots = replacements.get(rec.parent)
    if (slots === undefined) {
      slots = new Map()
      replacements.set(rec.parent, slots)
    }
    slots.set(rec.index, nodes)
    at = to
  }

  for (const [host, slots] of replacements) {
    const next: ElementContent[] = []
    host.children.forEach((child, index) => {
      const repl = slots.get(index)
      if (repl !== undefined) {
        next.push(...repl)
        return
      }
      if (child.type === "element") next.push(child)
    })
    host.children = next as typeof host.children
  }
}

/** One text node, as a slot in the haystack — HAST text has no parent
 *  pointer, so "replace that node" is not an operation this tree offers. */
type Slot = {
  parent: Root | Element
  index: number
  value: string
  tags: boolean
}

/** Pass 1: every text node, once, carrying down the one thing that varies
 *  along the way ({@link tagsIn}). Heading autolinks are skipped so a `#`
 *  appended by the pipeline is not in the haystack. Pass 2 iterates this
 *  array; it does not walk the tree again. */
const visitText = (
  parent: Root | Element,
  tags: boolean,
  out: Slot[],
): void => {
  parent.children.forEach((child, index) => {
    if (child.type === "text") {
      out.push({ parent, index, value: child.value, tags })
      return
    }
    if (child.type !== "element") return
    if (isAnchor(child)) return
    visitText(child, tagsIn(child, tags), out)
  })
}

/**
 * One window of the haystack, as the text and pills it turns out to be —
 * guarded by the format's own cheap negative, exactly as the HTML path below
 * and the search index are, because most text nodes hold no sigil at all.
 *
 * `haystack` is the string {@link litBy} searched; `from`/`to` is this node's
 * place in it. `runsIn` slices that same string. Remapping landings into
 * piece-local offsets would be a second opinion about where a needle sat.
 *
 * The inner `titleParts` cursor starts at `from`, not 0: a tag in a later
 * piece (`**urgent** #home`) sits at `from > 0`, and seeding at 0 would mark
 * the start of the haystack instead of the tag.
 *
 * TWO WAYS OUT WITH THE SAME ANSWER, and they are written as two because they
 * are two different facts. One is about WHERE this text is — literal markup,
 * where a `#…` is not a tag ({@link NO_TAGS_IN}) — and the other is about what
 * is IN it. Folding them into one `||` would be this file making, one line
 * further down, exactly the mistake it was rewritten to stop making: a claim
 * about tags and a claim about the walk travelling as one condition, with only
 * one of them argued for anywhere.
 */
const splitTags = (
  haystack: string,
  landed: ReadonlyArray<Lit>,
  from: number,
  to: number,
  tags: boolean,
): ElementContent[] => {
  const piece = haystack.slice(from, to)

  // Literal markup. The query's words are still lit — that is the whole of
  // what this stretch gives up, and it gives up nothing else.
  if (!tags) return marked(haystack, landed, from, to)

  // Prose with no sigil anywhere in it, which is most text nodes there are.
  if (!mayHoldTag(piece)) return marked(haystack, landed, from, to)

  const out: ElementContent[] = []
  let at = from
  for (const part of titleParts(piece)) {
    const written = part.kind === "tag" ? tagText(part) : part.text
    const next = at + written.length
    if (part.kind === "tag") out.push(pill(written, haystack, landed, at, next))
    else out.push(...marked(haystack, landed, at, next))
    at = next
  }
  return out
}

/** One stretch of ordinary text as the content it becomes: itself, or itself
 *  with the query's words wrapped in marks. */
const marked = (
  text: string,
  landed: ReadonlyArray<Lit>,
  from: number,
  to: number,
): ElementContent[] => {
  // The unfiltered shape, which is every title this app draws until somebody
  // types: one text node, no run list to walk and throw away.
  if (landed.length === 0) {
    return [{ type: "text", value: text.slice(from, to) } as ElementContent]
  }
  return runsIn(text, landed, from, to).map((run) =>
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
  const landed = litBy(text, needles)
  if (!mayHoldTag(text)) return markedHtml(text, landed, 0, text.length)
  let html = ""
  let at = 0
  for (const part of titleParts(text)) {
    const written = part.kind === "tag" ? tagText(part) : part.text
    const to = at + written.length
    if (part.kind !== "tag") html += markedHtml(text, landed, at, to)
    else {
      // AS WRITTEN in both places: the text a reader sees, and the value the
      // delegated press filters by — ONE binding, so the attribute and the
      // words inside the pill cannot be produced by two expressions that must
      // agree. `titleParts` restricts a tag's alphabet (`isTagName`), so the
      // attribute cannot carry a quote — and `escapeText` is applied anyway
      // rather than reasoned about at each call.
      html += `<span class="${TAG_CLASS}" data-testid="${TESTID.tag}" ${TAG_ATTRIBUTE}="${
        escapeText(written)
      }">${markedHtml(text, landed, at, to)}</span>`
    }
    at = to
  }
  return html
}

/** The same runs {@link marked} makes, written straight to HTML — and the
 *  `<mark>` has to stringify EXACTLY as `hast-util-to-html` writes the element
 *  above, which is what ./plain.test.ts holds the two paths to. */
const markedHtml = (
  text: string,
  landed: ReadonlyArray<Lit>,
  from: number,
  to: number,
): string => {
  // {@link marked}'s guard, one path over — the same reason, and the same
  // bytes it used to write before there was a query to answer.
  if (landed.length === 0) return escapeText(text.slice(from, to))
  return runsIn(text, landed, from, to)
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
  text: string,
  landed: ReadonlyArray<Lit>,
  from: number,
  to: number,
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
  children: marked(text, landed, from, to),
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
