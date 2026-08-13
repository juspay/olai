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
 *     `@olai/surface` spells the URL; this SAYS SO where the picture would have
 *     been when the answer is nothing, rather than deleting the element, which
 *     is how a typo'd filename used to render as a page with a hole in it.
 *   - **a link to a `.md` is a link to that document's page.** `[the deck](
 *     ../projects/deck.md)` is how a vault of Markdown files points at itself,
 *     and the browser would resolve it against whatever ROUTE the page is at —
 *     which is the document's own directory on `/doc/…` by luck, and the wrong
 *     place on `/d/<date>`, where a note is drawn under an address that is not
 *     a file at all. So it is resolved beside the file the link was WRITTEN in
 *     (`@olai/format`'s `documentOf`) and spelled as this app's own document
 *     route. Nothing else is touched: a `http:` link goes where it says, a
 *     fragment stays a fragment, and a relative path to anything that is not a
 *     document is left exactly as written.
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

import { documentOf, pictureOf } from "@olai/format"
import { mediaHref } from "@olai/surface"
import type { Element, Root } from "hast"

import { type Heading, headingOf } from "./outline.ts"
import { hrefOf } from "../routes.ts"
import { WELL } from "../surface.ts"
import { TESTID } from "../testids.ts"

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
  for (const child of parent.children) {
    if (child.type !== "element") continue
    if (child.tagName === "img") resolvePicture(child, options.from)
    if (child.tagName === "a") resolveDocument(child, options.from)
    mint(child, options.ids)
    walk(child, options, headings)
    // AFTER the subtree, so what a heading reads as is what is left of it.
    const heading = headingOf(child)
    if (heading !== null) headings.push(heading)
  }
}

/**
 * Point an `<img>` at the media route — or, when nothing here resolves, say so
 * IN PLACE OF THE PICTURE.
 *
 * It used to be deleted, subtree and all, and that is the bug: `![](shot.pngg)`
 * and `![](sh0t.png)` are the ordinary way of getting a picture wrong, and what
 * they produced was a page with nothing on it where the picture was meant to
 * be. Nobody can debug a blank — not the person who wrote the typo, and not the
 * agent asked why its picture is missing.
 *
 * The allowlist is unchanged and deliberately so: what is drawn is still only a
 * relative picture under the served root ({@link pictureOf} owns that rule, and
 * `.svg`, `data:` and remote hosts are still refused). What changes is that a
 * refusal is now VISIBLE and names what it refused, which costs the reader
 * nothing and tells them everything. The name is the `src` the markdown wrote,
 * because that is the string a reader has to go and fix — never the resolved
 * path, which is ours.
 *
 * The element is REWRITTEN rather than replaced so the walk above stays one
 * pass over one array: an `<img>` is void, so there is no subtree to carry.
 */
const resolvePicture = (element: Element, from: string): void => {
  const written = element.properties?.["src"]
  const src = typeof written === "string" ? written : ""
  const picture = src === "" ? null : pictureOf(from, src)
  if (picture !== null) {
    element.properties = { ...element.properties, src: mediaHref(picture) }
    return
  }

  element.tagName = "span"
  element.properties = {
    className: [UNDRAWN],
    "data-testid": TESTID.undrawnPicture,
    // Only when there IS one. An `![](…)` with nothing in it has no name to
    // carry, and an attribute holding the words "no file named" would be prose
    // in a slot every reader of the DOM takes for a src.
    ...(src === "" ? {} : { "data-src": src }),
  }
  element.children = [{
    type: "text",
    // No `src` at all is TWO things and this pass cannot tell them apart: an
    // `![]()` with nothing in it, and an address the SANITISER already took
    // away before this walk ran (a `data:` URI is the one that reaches here
    // that way — the allowlist is the security boundary and runs first, which
    // is the right order and not something to work around). So the sentence
    // covers both rather than guessing at one.
    value: src === ""
      ? "this picture could not be drawn: its address was empty, or not one this page may fetch"
      : `this picture could not be drawn: ${src}`,
  }]
}

/**
 * Point an `<a>` at a served document's own page, when that is what it names.
 *
 * The one thing this decides that `documentOf` does not is the FRAGMENT. A
 * vault writes `[the bed](garden.md#beds)`, and the path and the anchor are two
 * different questions: the path is a file to resolve, the anchor is what to do
 * once the page is there. So it is cut off before the arithmetic and put back
 * afterwards, verbatim — this pass mints ids per rendered BLOCK ({@link mint}),
 * so an anchor into another page is a thing that page will have to answer for,
 * and dropping it here would be this pass deciding it never existed.
 *
 * A link this leaves alone is a link that goes exactly where it says. There is
 * no allowlist to widen and no refusal to draw: the sanitiser has already run
 * (it is the security boundary, and it runs first), an `http:` link is somebody
 * pointing at the internet on purpose, and a relative path to something that is
 * not a document is not this app's to reinterpret.
 *
 * Whether the directory HOLDS the document is not asked, for the same reason
 * `/doc/<anything>` is an address a person may type: the page model already has
 * a screen that names a document it does not have, and a link quietly left
 * relative would send the reader somewhere with nothing to say at all.
 */
const resolveDocument = (element: Element, from: string): void => {
  const written = element.properties?.["href"]
  if (typeof written !== "string") return
  // ONE index, so the two halves cannot be cut at two places: an href with no
  // `#` ends at its own end, which makes the fragment the empty tail.
  const cut = written.includes("#") ? written.indexOf("#") : written.length
  const document = documentOf(from, written.slice(0, cut))
  if (document === null) return
  element.properties = {
    ...element.properties,
    href: hrefOf({ kind: "document", file: document }) + written.slice(cut),
  }
}

/** What an undrawn picture looks like: a WELL at chip scale (`../surface.ts`),
 *  the same recess an inline run of code sits in — visible enough to be seen
 *  where the picture was, quiet enough that a page of them is still a page of
 *  text, and a hole in the sheet rather than a box drawn on it. */
const UNDRAWN = `inline-block rounded ${WELL} px-1.5 py-0.5 ` +
  "font-mono text-xs text-muted"

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
