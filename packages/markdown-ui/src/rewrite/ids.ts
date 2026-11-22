/**
 * IDS BELONG TO THE PAGE, NOT TO THE PARSER.
 *
 * Every rendered block on a page — a note per row, a document, and every note
 * under it — is a separate run of the pipeline, and each would otherwise mint
 * `fn-1` for its first footnote, and `#shape` for its first `## Shape`. So
 * every id gets this block's own prefix, and every link into the same block
 * gets the same prefix, which keeps a footnote pointing at its own note and
 * out of the one above it, and a heading anchor pointing at its own heading.
 *
 * A link into a DOCUMENT's own heading is the one that leaves the block: it
 * carries the app route that heading stands for ({@link headingRoute}), so a
 * contents entry and a `[…](#beds)` in the prose land in the same place.
 */
import { addressOf, bodyKind, type Claims, printAddress } from "@olai/format"
import type { Element } from "hast"

/** The app route a heading of this block stands for, by its authored slug — or
 *  `undefined` where the slug names no heading of a document. */
export type HeadingRoute = (slug: string) => string | undefined

/**
 * {@link HeadingRoute} for this block, or `null` when the block is not a
 * document's own body.
 *
 * A document heading has a route href (`notes/beds.md#beds`), while its
 * rendered element keeps a namespaced id. Outline-note fragments stay local:
 * interpreting those as outline rows would change what their author meant.
 */
export const headingRoute = (claims: Claims | undefined, from: string): HeadingRoute | null => {
  if (claims === undefined || bodyKind(claims, from) === null) return null
  return (slug) => {
    const address = addressOf(claims, from, slug)
    return address?.kind === "heading" ? "/" + printAddress(address) : undefined
  }
}

/** Move this element's id, and any link into this block, into the block's own
 *  namespace. Applied to every id rather than to the footnote ids alone: the
 *  rule is "the ids on the page are ours", and a rule with an exception is a
 *  rule with a collision. A link into a document's own heading also carries
 *  its route, by the AUTHORED slug — the one `landingId` translates. */
export const mint = (element: Element, ids: string, route: HeadingRoute | null): void => {
  const properties = element.properties
  if (properties === undefined) return

  const id = properties["id"]
  if (typeof id === "string") properties["id"] = `${ids}-${id}`

  const href = properties["href"]
  if (typeof href === "string" && href.startsWith("#")) {
    const at = href.length > 1 ? route?.(authored(href.slice(1))) : undefined
    properties["href"] = at ?? `#${ids}-${href.slice(1)}`
  }
}

/** A fragment as the markdown spelled it, read back to the slug it names: the
 *  parser percent-encodes what a heading's id holds verbatim. An unreadable one
 *  is kept as written rather than sinking the link. */
const authored = (fragment: string): string => {
  try { return decodeURIComponent(fragment) } catch { return fragment }
}
