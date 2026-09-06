/**
 * The heading tree a rendered block turned out to have.
 *
 * A table of contents is DERIVED, at view time, from the headings the pipeline
 * just drew — there is no outline stored beside a document, no field on the
 * wire, and nothing that could disagree with the text on screen. What a reader
 * jumps to is an id that is actually on the page.
 *
 * Which is why it is read out of the FINISHED TREE rather than out of the
 * markdown source. The ids are ./anchors.ts's, minted from each heading's own
 * text; ./rewrite.ts then moves them into the block's own namespace, and only
 * after that are they the strings a `href="#…"` has to say. Parsing the source
 * a second time would produce a plausible contents pointing at ids that do not
 * exist.
 *
 * A heading with no id contributes nothing — it cannot be jumped to, so a line
 * naming it would be a dead entry rather than a survey.
 */

import type { Element } from "hast"

import { textOf } from "./anchors.ts"

/** One line of a table of contents. */
export interface Heading {
  /** `1`–`6`, as written. The ToC re-bases these against the shallowest
   *  heading the document actually has: a document whose top level is `##` is
   *  not a document indented one step. */
  readonly depth: number
  /** The id ON THE PAGE — namespaced, and exactly what a fragment must say. */
  readonly id: string
  /** What the heading reads as. */
  readonly text: string
}

/**
 * This element as a line of the contents, or `null` if it is not a heading
 * anything can be pointed at.
 *
 * Asked of EVERY element of every rendered block — ./rewrite.ts's walk is the
 * only pass that has the final ids — so the "no" answer is what has to be
 * cheap. It is two character comparisons: a heading is the only tag that is
 * `h` and a digit, and `<hr>` is the only other two-letter tag starting `h`.
 */
export const headingOf = (element: Element): Heading | null => {
  const tag = element.tagName
  if (tag.length !== 2 || tag[0] !== "h") return null
  const depth = Number(tag[1])
  if (!(depth >= 1 && depth <= 6)) return null

  const id = element.properties?.["id"]
  if (typeof id !== "string" || id === "") return null
  return { depth, id, text: textOf(element) }
}
