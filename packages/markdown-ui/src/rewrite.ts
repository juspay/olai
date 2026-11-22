/**
 * The pass that runs after the sanitiser: what the page is allowed to point at.
 *
 * It is ONE WALK over the finished tree, and this file is that walk. What it
 * decides at each element is a job of its own, and each job is its own module:
 *
 *   - **a picture is a file in the served directory** — `./rewrite/
 *     pictures.ts`;
 *   - **a link to a `.md` is a link to that document's page** — `./rewrite/
 *     links.ts`, which also holds the one answer both kinds of link are drawn
 *     from, the other writer of it being `./wikilinks.ts`;
 *   - **ids belong to the page, not to the parser** — `./rewrite/ids.ts`.
 *
 * None of the three is about markdown: each is about the rendered block's
 * relationship to the page around it, which is why they are one walk over the
 * finished tree rather than three plugins inside the pipeline.
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

import type { Claims, Names } from "@olai/format"
import type { Element, Root } from "hast"

import { type Heading, headingOf } from "./outline.ts"
import { type HeadingRoute, headingRoute, mint } from "./rewrite/ids.ts"
import { openExternal, resolveDocument } from "./rewrite/links.ts"
import { type Pictures, resolvePicture } from "./rewrite/pictures.ts"
import { drawWikilink, wikilinkOf } from "./wikilinks.ts"


export interface Rewrite {
  readonly claims: Claims | undefined
  /** The file the markdown was written in — an outline, for a note; the
   *  document itself, for a document. A relative picture is resolved beside
   *  it, exactly as a relative prose link is. */
  readonly from: string
  /** The directory's name index, which holds its membership too — the vault
   *  plugin's served directory owns it and hands it down. */
  readonly names?: Names
  /** This block's id namespace. */
  readonly ids: string
  /** A title: one line high, so an embed of a picture draws as a link. */
  readonly inline?: boolean
}

/** Rewrite the tree in place, and say what headings it turned out to have —
 *  in document order, which is the order a table of contents is read in. */
export const rewrite = (tree: Root, options: Rewrite): readonly Heading[] => {
  const headings: Heading[] = []
  walk(tree, options, headings, headingRoute(options.claims, options.from), { drawn: 0 })
  return headings
}

const walk = (
  parent: Root | Element,
  options: Rewrite,
  headings: Heading[],
  route: HeadingRoute | null,
  pictures: Pictures,
): void => {
  for (const child of parent.children) {
    if (child.type !== "element") continue
    if (child.tagName === "img") resolvePicture(child, options.claims, options.from, pictures)
    if (child.tagName === "a") {
      const written = wikilinkOf(child)
      if (written !== undefined) {
        drawWikilink(child, written, options.claims, options.names, options.from, options.inline === true, pictures)
      } else {
        // Document first: a relative `.md` becomes a page address and must not then
        // be treated as something that leaves the app.
        resolveDocument(child, options.claims, options.names, options.from)
        openExternal(child)
      }
    }
    // The slug as authored, before `mint` moves it into this block's namespace.
    const slug = child.properties?.["id"]
    mint(child, options.ids, route)
    walk(child, options, headings, route, pictures)
    // AFTER the subtree, so what a heading reads as is what is left of it.
    const heading = headingOf(child)
    if (heading === null) continue
    const at = typeof slug === "string" ? route?.(slug) : undefined
    headings.push(at === undefined ? heading : { ...heading, route: at })
  }
}
