/**
 * The pass that runs after the sanitiser: what the page is allowed to point at.
 *
 * Two things markdown says that only this app can answer, and both are about
 * the rendered block's relationship to the page around it rather than about
 * markdown at all — which is why they are one walk over the finished tree
 * rather than two plugins inside the pipeline:
 *
 *   - **a picture is a file in the served directory.** `![](shot.png)` names a
 *     file beside the text that wrote it, and the browser can only fetch a
 *     URL, so the relative path becomes `/media/…`. Anything that is not a
 *     relative picture is not drawn AT ALL — no remote host (a page that
 *     fetched one would tell a third party what someone is reading), no
 *     `data:`, no absolute path. `@olai/format` decides what resolves and
 *     `@olai/surface` spells the URL; this drops the element when the answer is
 *     nothing.
 *   - **ids belong to the page, not to the parser.** Every rendered block on a
 *     page — a note per row, a document, and every note under it — is a
 *     separate run of the pipeline, and each would otherwise mint `fn-1` for
 *     its first footnote, and `#shape` for its first `## Shape`. So every id
 *     gets this block's own prefix, and every link into the same block gets the
 *     same prefix, which keeps a footnote pointing at its own note and out of
 *     the one above it, and a heading anchor pointing at its own heading.
 *
 * It runs LAST, after the sanitiser, and that order is what makes it safe to
 * write attributes here: what the sanitiser passed is a URL we then narrow, and
 * what it rejected never reaches this walk at all.
 *
 * Being last is also why the walk REPORTS the heading tree on its way through
 * (./outline.ts). The contents a document draws has to name the ids a reader
 * can actually jump to, and until this pass has run those ids do not exist yet.
 * A second walk to collect them would be a second walk over the same tree
 * asking a question this one already has the answer to.
 */

import { pictureOf } from "@olai/format"
import { mediaHref } from "@olai/surface"
import type { Element, Root } from "hast"

import { type Heading, headingOf } from "./outline.ts"

export interface Rewrite {
  /** The file the markdown was written in — an outline, for a note; the
   *  document itself, for a document. A relative picture is resolved beside
   *  it, exactly as a `doc` is. */
  readonly from: string
  /** This block's id namespace. */
  readonly ids: string
}

/** Rewrite the tree in place, and say what headings it turned out to have —
 *  in document order, which is the order a table of contents is read in. */
export const rewrite = (tree: Root, options: Rewrite): readonly Heading[] => {
  const headings: Heading[] = []
  walk(tree, options, headings)
  return headings
}

const walk = (parent: Root | Element, options: Rewrite, headings: Heading[]): void => {
  // Filtered rather than mutated in place, because one of the answers is "this
  // element is not drawn": `keep` is the walk AND the verdict, so an image that
  // resolves to nothing is gone with its subtree instead of left behind as an
  // empty box.
  parent.children = parent.children.filter((child) => {
    if (child.type !== "element") return true
    if (child.tagName === "img" && !point(child, options.from)) return false
    mint(child, options.ids)
    walk(child, options, headings)
    // AFTER the subtree, so what a heading reads as is what is left of it: a
    // picture inside one that resolved to nothing is gone by now.
    const heading = headingOf(child)
    if (heading !== null) headings.push(heading)
    return true
  })
}

/** Point an `<img>` at the media route, or say it cannot be drawn. */
const point = (element: Element, from: string): boolean => {
  const src = element.properties?.["src"]
  if (typeof src !== "string") return false
  const picture = pictureOf(from, src)
  if (picture === null) return false
  element.properties["src"] = mediaHref(picture)
  return true
}

/** Move this element's id, and any link into this block, into the block's own
 *  namespace. Applied to every id rather than to the footnote ids alone: the
 *  rule is "the ids on the page are ours", and a rule with an exception is a
 *  rule with a collision. */
const mint = (element: Element, ids: string): void => {
  const properties = element.properties
  if (properties === undefined) return

  const id = properties["id"]
  if (typeof id === "string") properties["id"] = `${ids}-${id}`

  const href = properties["href"]
  if (typeof href === "string" && href.startsWith("#")) {
    properties["href"] = `#${ids}-${href.slice(1)}`
  }
}
