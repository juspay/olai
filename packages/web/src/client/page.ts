/**
 * Which page a route is, once the set is known.
 *
 * A route is text; a page is what that text turned out to name. Resolving one
 * into the other in a single place is what keeps the sidebar and the main pane
 * agreeing: the entry that lights up is the outline the OPEN PAGE lives in, and
 * for a zoomed node that answer is the canonical node's file — which no amount
 * of reading the URL would tell you.
 *
 * Every arm carries exactly what its screen needs and nothing else, so no
 * component re-decides what it is looking at. The ROWS are the exception, and
 * {@link rowsFor} says why. Nothing about the format is decided here either:
 * `@olai/format` says what an id resolves to, which file a node lives in, and
 * what a file's tree is; this picks the arm.
 */

import type { BrokenFile, Derived, Row, Zoomed } from "@olai/format"
import { rowsOf, rowsUnder, zoom } from "@olai/format"

import type { Route } from "./routes.ts"

export type Page =
  | { readonly kind: "outline"; readonly file: string }
  | { readonly kind: "node"; readonly zoomed: Zoomed }
  /** An outline whose file did not parse: it has no tree to draw, so its own
   *  pane carries its errors instead. Every other outline is unaffected. */
  | { readonly kind: "broken"; readonly file: BrokenFile }
  /** Nothing to show. `requested` is the outline the URL named and the
   *  directory does not have — `null` when the directory has no outlines at
   *  all, which is a different thing to tell the reader. */
  | { readonly kind: "nothing"; readonly requested: string | null }

export const pageOf = (
  derived: Derived,
  files: ReadonlyArray<string>,
  broken: ReadonlyMap<string, BrokenFile>,
  route: Route,
): Page => {
  if (route.kind === "node") return { kind: "node", zoomed: zoom(derived, route.id) }

  // `/` is whichever outline was found first; a named one has to be served.
  const file = route.file === null
    ? files[0]
    : files.includes(route.file)
    ? route.file
    : undefined
  if (file === undefined) {
    return { kind: "nothing", requested: files.length === 0 ? null : route.file }
  }
  const unreadable = broken.get(file)
  return unreadable === undefined
    ? { kind: "outline", file }
    : { kind: "broken", file: unreadable }
}

/** The outline the open page belongs to — the sidebar entry to light up. A
 *  zoomed node belongs to the file its CANONICAL record is in, whichever file
 *  the mirror that was clicked lived in. */
export const outlineOf = (page: Page): string | undefined => {
  if (page.kind === "outline") return page.file
  if (page.kind === "broken") return page.file.file
  if (page.kind === "node" && page.zoomed.kind === "node") return page.zoomed.shows.file
  return undefined
}

/**
 * The rows a page draws, before this reading hides any of them. An outline's
 * roots and a zoomed node's children are the same kind of thing, which is what
 * lets one store hold whichever is on screen.
 *
 * Built FRESH on every call, and that is load-bearing: the store reconciles
 * these objects, and reconciling writes INTO them. Handing over an array some
 * memo is also holding would let a filtered view — done nodes hidden — become
 * what that memo thinks the outline is, and the hidden rows would never come
 * back. The page decides WHICH rows; it does not keep them.
 */
export const rowsFor = (
  derived: Derived,
  page: Page | undefined,
): ReadonlyArray<Row> => {
  if (page === undefined) return []
  if (page.kind === "outline") return rowsOf(derived, page.file)
  if (page.kind === "node" && page.zoomed.kind === "node") {
    return rowsUnder(derived, page.zoomed.shows, page.zoomed.trail)
  }
  return []
}
