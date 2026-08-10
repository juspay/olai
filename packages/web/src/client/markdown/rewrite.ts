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
 *     its first footnote. So every id gets this block's own prefix, and every
 *     link into the same block gets the same prefix, which keeps a footnote
 *     pointing at its own note and out of the one above it.
 *
 * It runs LAST, after the sanitiser, and that order is what makes it safe to
 * write attributes here: what the sanitiser passed is a URL we then narrow, and
 * what it rejected never reaches this walk at all.
 */

import { pictureOf } from "@olai/format"
import { mediaHref } from "@olai/surface"
import type { Element, Root } from "hast"

export interface Rewrite {
  /** The file the markdown was written in — an outline, for a note; the
   *  document itself, for a document. A relative picture is resolved beside
   *  it, exactly as a `doc` is. */
  readonly from: string
  /** This block's id namespace. */
  readonly ids: string
}

export const rewrite = (tree: Root, options: Rewrite): void => {
  walk(tree, options)
}

const walk = (parent: Root | Element, options: Rewrite): void => {
  // Filtered rather than mutated in place, because one of the answers is "this
  // element is not drawn": `keep` is the walk AND the verdict, so an image that
  // resolves to nothing is gone with its subtree instead of left behind as an
  // empty box.
  parent.children = parent.children.filter((child) => {
    if (child.type !== "element") return true
    if (child.tagName === "img" && !point(child, options.from)) return false
    mint(child, options.ids)
    walk(child, options)
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
