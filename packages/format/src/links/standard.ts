/**
 * WHERE A STANDARD LINK GOES — one function from a cut address (`@olai/prose`'s
 * `cut`: the path, the query and the fragment, cut once) to a place. The
 * references index, the dead-link reading and the page all ask it, so a
 * `[q](finishes.md?v=1)` is a link to `finishes.md` for all three.
 */
import type { Cut } from "@olai/prose/read.ts"

import { type Address, addressOf } from "../address.ts"
import type { Claims } from "../kinds.ts"
import { isPicture } from "../serving.ts"
import { decodeHref, pathedOf } from "./paths.ts"

/**
 * The picture a markdown `![](…)` names, as a path relative to the served
 * directory — or `null` for a source this app does not draw at all.
 *
 * `from` is the file the markdown was written in: the outline, for a note; the
 * document itself, for a document. So a picture is resolved beside the text
 * that names it, just like a note link.
 *
 * Only a RELATIVE path to a picture survives: the address rule is
 * `./paths.ts`'s, and the extension allowlist is this one's. A page that
 * fetched a remote image would be a page that told a third party what someone
 * is reading, and an address off the allowlist is a way of drawing something
 * that is not a file in this directory.
 */
export const pictureOf = (claims: Claims, from: string, src: string): string | null => {
  const resolved = pathedOf(from, src)
  return resolved !== null && isPicture(claims, resolved) ? resolved : null
}

/** Where a standard link goes: a FILE of the directory — its path, with the
 *  query and the fragment the link carries on — or a ROW by its id (`#id`,
 *  the one link with no file half). */
export type Place =
  | { readonly kind: "file"; readonly path: string; readonly query: string | null; readonly fragment: string | null }
  | { readonly kind: "row"; readonly id: string }

/**
 * The place a link written in `from` goes, or `null` for an address this app
 * does not resolve — a scheme, a host, an absolute path (`./paths.ts`'s
 * refusals), a folder or a `.`. Resolved from the PATH alone: a query is
 * where the page lands, never which file it is, so `finishes.md?v=1` is
 * `finishes.md`. Which files the directory holds is not asked here.
 */
export const placeOf = (from: string, link: Cut): Place | null => {
  if (link.path === "") return link.query === null && link.fragment !== null && link.fragment !== "" ? { kind: "row", id: link.fragment } : null
  const decoded = decodeHref(link.path)
  const last = decoded?.split("/").at(-1)
  if (decoded === null || last === "" || last === "." || last === "..") return null
  const path = pathedOf(from, link.path)
  if (path === null || path === "") return null
  return { kind: "file", path, query: link.query, fragment: link.fragment }
}

/** The address a place is in the grammar — a file, a heading or row of one,
 *  or a row by its id — or `null` where the grammar has none. */
export const addressOfPlace = (claims: Claims, place: Place): Address | null =>
  place.kind === "row" ? addressOf(claims, null, place.id) : addressOf(claims, place.path, place.fragment)

