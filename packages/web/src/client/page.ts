/**
 * Which page a route is, once the set is known.
 *
 * A route is text; a page is what that text turned out to name. Resolving one
 * into the other in a single place is what keeps the sidebar and the main pane
 * agreeing: the entry that lights up is the file the OPEN PAGE lives in, and
 * for a zoomed node that answer is the canonical node's file — which no amount
 * of reading the URL would tell you.
 *
 * A route is text and so is a DAY, which is why `today` is an argument here
 * rather than a clock read further down: `/today` and `/d/<date>` are the same
 * page, and the only difference between them is who says which day it is.
 *
 * Every arm carries exactly what its screen needs and nothing else, so no
 * component re-decides what it is looking at. The ROWS are the exception, and
 * {@link rowsFor} says why. Nothing about the format is decided here either:
 * `@olai/format` says what an id resolves to, which file a node lives in, what
 * a file's tree is and what is dated a given day; this picks the arm.
 */

import type { BrokenFile, DayGroup, Derived, Document, Row, Zoomed } from "@olai/format"
import { datedOn, rowsOf, rowsUnder, zoom } from "@olai/format"

import type { Route } from "./routes.ts"

export type Page =
  | { readonly kind: "outline"; readonly file: string }
  /** One document, drawn whole. It carries the TEXT rather than the path,
   *  because the set already holds it: a page that carried the name and left
   *  the reading to the component would be a second lookup that could miss. */
  | { readonly kind: "document"; readonly document: Document }
  | { readonly kind: "node"; readonly zoomed: Zoomed }
  /** One day, whatever it holds: every node dated it, grouped by the outline
   *  it lives in. An empty `groups` is a day with nothing on it, which is a
   *  page that says so rather than a page that is missing. */
  | {
    readonly kind: "day"
    readonly date: string
    readonly groups: ReadonlyArray<DayGroup>
  }
  /** An outline whose file did not parse: it has no tree to draw, so its own
   *  pane carries its errors instead. Every other outline is unaffected. */
  | { readonly kind: "broken"; readonly file: BrokenFile }
  /** Nothing to show. `requested` is the file the URL named and the directory
   *  does not have — `null` when the directory has no outlines at all, which
   *  is a different thing to tell the reader — and `sought` is what it was
   *  looking for, because "no such outline" and "no such document" send a
   *  reader to two different places. */
  | {
    readonly kind: "nothing"
    readonly sought: "outline" | "document"
    readonly requested: string | null
  }

/** The set, as the page model reads it: what was found, and what could not be
 *  read. One argument rather than three, because they are one snapshot and a
 *  caller cannot hand over half of it. */
export interface Found {
  readonly files: ReadonlyArray<string>
  /** By path, like `broken` — an address names one, and the app holds the one
   *  index everything that answers "which document is this" reads. */
  readonly documents: ReadonlyMap<string, Document>
  readonly broken: ReadonlyMap<string, BrokenFile>
}

export const pageOf = (
  derived: Derived,
  found: Found,
  route: Route,
  /** What day it is, as text. The one thing here that is not a fact about the
   *  set — and the only reason `/today` can be an address rather than a
   *  redirect that would put yesterday in someone's history. */
  today: string,
): Page => {
  if (route.kind === "node") return { kind: "node", zoomed: zoom(derived, route.id) }

  if (route.kind === "document") {
    const document = found.documents.get(route.file)
    return document === undefined
      ? { kind: "nothing", sought: "document", requested: route.file }
      : { kind: "document", document }
  }

  if (route.kind === "day" || route.kind === "today") {
    const date = route.kind === "today" ? today : route.date
    return { kind: "day", date, groups: datedOn(derived, date) }
  }

  // `/` is whichever outline was found first; a named one has to be served.
  const file = route.file === null
    ? found.files[0]
    : found.files.includes(route.file)
    ? route.file
    : undefined
  if (file === undefined) {
    return {
      kind: "nothing",
      sought: "outline",
      requested: found.files.length === 0 ? null : route.file,
    }
  }
  const unreadable = found.broken.get(file)
  return unreadable === undefined
    ? { kind: "outline", file }
    : { kind: "broken", file: unreadable }
}

/** The file the open page belongs to — the sidebar entry to light up, in
 *  whichever of its two lists. A zoomed node belongs to the file its CANONICAL
 *  record is in, whichever file the mirror that was clicked lived in; a
 *  document belongs to itself. */
export const fileOf = (page: Page): string | undefined => {
  if (page.kind === "outline") return page.file
  if (page.kind === "document") return page.document.file
  if (page.kind === "broken") return page.file.file
  if (page.kind === "node" && page.zoomed.kind === "node") return page.zoomed.shows.file
  return undefined
}

/**
 * The rows a page draws, before this reading hides any of them. An outline's
 * roots and a zoomed node's children are the same kind of thing, which is what
 * lets one derivation cover whichever is on screen.
 *
 * The WRAPPERS are minted fresh on every call and the RECORDS inside them are
 * the served set's own, borrowed rather than copied — and both halves are
 * load-bearing. Fresh wrappers are what let a filtered view (done nodes
 * hidden) be a different array rather than an edit to the one the tree is;
 * borrowed records are why none of this may ever be handed to a store, because
 * `reconcile` writes INTO what it is given and what it would be writing into
 * is the set itself. App.tsx says what that cost while it was.
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
