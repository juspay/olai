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
 * component re-decides what it is looking at. Nothing about the format is
 * decided here either: `@olai/format` says what an id resolves to and which
 * file a node lives in; this picks the arm.
 */

import { type Derived, zoom, type Zoomed } from "@olai/format"

import type { Route } from "./routes.ts"

export type Page =
  | { readonly kind: "outline"; readonly file: string }
  | { readonly kind: "node"; readonly zoomed: Zoomed }
  /** Nothing to show. `requested` is the outline the URL named and the
   *  directory does not have — `null` when the directory has no outlines at
   *  all, which is a different thing to tell the reader. */
  | { readonly kind: "nothing"; readonly requested: string | null }

export const pageOf = (
  derived: Derived,
  files: ReadonlyArray<string>,
  route: Route,
): Page => {
  if (route.kind === "node") return { kind: "node", zoomed: zoom(derived, route.id) }

  // `/` is whichever outline was found first; a named one has to be served.
  const file = route.file === null
    ? files[0]
    : files.includes(route.file)
    ? route.file
    : undefined
  if (file !== undefined) return { kind: "outline", file }
  return { kind: "nothing", requested: files.length === 0 ? null : route.file }
}

/** The outline the open page belongs to — the sidebar entry to light up. A
 *  zoomed node belongs to the file its CANONICAL record is in, whichever file
 *  the mirror that was clicked lived in. */
export const outlineOf = (page: Page | undefined): string | undefined => {
  if (page === undefined) return undefined
  if (page.kind === "outline") return page.file
  if (page.kind === "node" && page.zoomed.kind === "node") return page.zoomed.shows.file
  return undefined
}

/**
 * The page, when it is the one asked for.
 *
 * Solid's `<Match>` narrows to whatever its `when` returns, and "this union
 * member" is not something a JSX condition can express on its own. One helper
 * with one cast, rather than a memo per arm at every use site.
 */
export const arm = <K extends Page["kind"]>(
  page: Page | undefined,
  kind: K,
): Extract<Page, { readonly kind: K }> | undefined =>
  page?.kind === kind ? (page as Extract<Page, { readonly kind: K }>) : undefined
