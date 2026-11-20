/**
 * Two renderings of the same pill live here ({@link styleTags} and
 * {@link taggedHtml}), and they must agree.
 */

import { TESTID } from "@olai/markdown-ui/testids.ts"
import { litBy, type Lit, mayHoldTag, tagText, titleParts } from "@olai/format"
import type { Element, ElementContent, Root } from "hast"

import { HIT_CLASS, NO_NEEDLES, runsIn } from "@olai/markdown-ui/lit.ts"
import { TAG_ATTRIBUTE } from "./tag-contract.ts"

import { tagStyle } from "@olai/appearance/tagInk.ts"
import { isAnchor } from "./anchors.ts"

export const TAG_CLASS =
  "olai-tag inline whitespace-nowrap text-[0.8125rem] font-normal leading-snug"

const NO_TAGS_IN = new Set(["code", "a"])

const tagsIn = (element: Element, outer: boolean): boolean =>
  outer && !NO_TAGS_IN.has(element.tagName)

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

type Slot = {
  parent: Root | Element
  index: number
  value: string
  tags: boolean
}

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

const splitTags = (
  haystack: string,
  landed: ReadonlyArray<Lit>,
  from: number,
  to: number,
  tags: boolean,
): ElementContent[] => {
  const piece = haystack.slice(from, to)

  if (!tags) return marked(haystack, landed, from, to)

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

const marked = (
  text: string,
  landed: ReadonlyArray<Lit>,
  from: number,
  to: number,
): ElementContent[] => {
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
      html += `<span class="${TAG_CLASS}" data-testid="${TESTID.tag}" ${TAG_ATTRIBUTE}="${
        escapeText(written)
      }" style="${tagStyle(written)}">${markedHtml(text, landed, at, to)}</span>`
    }
    at = to
  }
  return html
}

const markedHtml = (
  text: string,
  landed: ReadonlyArray<Lit>,
  from: number,
  to: number,
): string => {
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
    // Last, and in the
    // same position on the string-written pill above — `hast-util-to-html`
    // emits properties in order, and the two paths promising byte-identity
    // (./plain.test.ts) includes this.
    style: tagStyle(written),
  },
  children: marked(text, landed, from, to),
})

/** Text, escaped EXACTLY the way `hast-util-to-html` escapes it: the two
 *  characters in its subset, `&` and `<`, each written as the numeric
 *  reference it writes rather than the named one a person would. ./plain.ts
 *  writes titles to HTML without the pipeline and must produce its bytes. */
export const escapeText = (value: string): string =>
  value.replace(/&/g, "&#x26;").replace(/</g, "&#x3C;")

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
