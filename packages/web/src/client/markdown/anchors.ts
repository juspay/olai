/**
 * A heading's own address.
 *
 * A long document — an architecture note runs to hundreds of lines — has no
 * way to be surveyed or jumped around. This is the half of the answer that
 * lives in the pipeline: `rehype-slug` gives every heading an `id` made from
 * its own text, and `rehype-autolink-headings` puts a small link beside it
 * pointing at that id. ./outline.ts is the other half, which reads those same
 * ids back out as a heading tree, and `document/Toc.tsx` draws it.
 *
 * ## Why this runs BEFORE the sanitiser, where the highlighter runs after
 *
 * ./render.ts attaches `rehype-highlight` after the allowlist deliberately:
 * its spans are made out of the code's own text and there is no author input
 * in them at all. An anchor is not quite that. The `id` is derived from a
 * heading a person, an agent or a git merge wrote, and the `href` is a URL
 * minted from it. Something that turns somebody's text into a URL belongs on
 * the INSIDE of the boundary, where the allowlist gets a look at what it
 * produced — not after it, where it would be trusted by position rather than
 * by rule.
 *
 * What the allowlist had to be told for it is one class value, and that
 * decision lives with the boundary rather than here: ./sanitise.ts.
 */

import type { Element } from "hast"
import type { Options as AutolinkOptions } from "rehype-autolink-headings"

/** The class the anchor carries — the one value ./sanitise.ts admits, the hook
 *  `styles.css` draws it by, and what {@link textOf} skips. One spelling, so
 *  those three cannot disagree. */
export const ANCHOR_CLASS = "olai-md-anchor"

/**
 * The anchor itself: appended INSIDE the heading, so it moves with the text it
 * belongs to and a reader tabbing through the page meets it in reading order.
 *
 * `#` rather than a link glyph, because it is the character the address bar is
 * about to show — and because a picture here would be an `svg` the allowlist
 * would have to be told about, to say what one character already says.
 *
 * `aria-label` needs no addition to the allowlist and is not decoration: an
 * anchor whose whole text is `#` is a link that says nothing, and a page of
 * them is a link list of identical hashes for anyone reading by ear. So it
 * names the section, and is built per heading rather than declared once.
 */
export const AUTOLINK: AutolinkOptions = {
  behavior: "append",
  content: { type: "text", value: "#" },
  properties: (heading) => ({
    className: [ANCHOR_CLASS],
    // Read BEFORE this anchor exists, so the label is the heading and not the
    // heading plus a hash.
    ariaLabel: `Link to “${textOf(heading)}”`,
  }),
}

/**
 * The text an element reads as, WITHOUT the anchor inside it — the anchor's own
 * label above, and every line of the table of contents (./outline.ts).
 *
 * It lives here because the exclusion is the whole of it: the anchor is a CHILD
 * of the heading it belongs to, so the naive answer puts a `#` on the end of
 * every entry in the contents and inside every label. The module that appends
 * the anchor is the one that knows how to read past it.
 *
 * Whitespace is collapsed because the tree keeps the source's: a heading broken
 * across two lines in a file is one line in a table of contents.
 */
export const textOf = (element: Element): string => read(element).replace(/\s+/g, " ").trim()

const read = (element: Element): string => {
  let text = ""
  for (const child of element.children) {
    if (child.type === "text") text += child.value
    else if (child.type === "element" && !isAnchor(child)) text += read(child)
  }
  return text
}

const isAnchor = (element: Element): boolean => {
  const classes = element.properties?.["className"]
  return Array.isArray(classes) && classes.includes(ANCHOR_CLASS)
}
