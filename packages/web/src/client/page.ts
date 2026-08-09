/**
 * Which page a route is, once the set is known.
 *
 * A route is text; a page is what that text turned out to name. Resolving one
 * into the other in a single place is what keeps the sidebar and the main pane
 * agreeing: the entry that lights up is the outline the OPEN PAGE lives in, and
 * for a zoomed node that answer is the canonical node's file — which no amount
 * of reading the URL would tell you.
 *
 * Nothing about the format is decided here. `@olai/format` says what an id
 * resolves to and which file a node lives in; this picks the arm.
 */

import { type Derived, zoom, type Zoomed } from "@olai/format"

import type { Route } from "./routes.ts"

export type Page =
  | {
    readonly kind: "outline"
    /** The outline actually open, or `undefined` when the URL names one the
     *  served directory does not have. */
    readonly file: string | undefined
    /** What the URL asked for, so the empty state can say which of its two
     *  nothings this is. */
    readonly requested: string | null
  }
  | { readonly kind: "node"; readonly zoomed: Zoomed }

export const pageOf = (
  derived: Derived,
  files: ReadonlyArray<string>,
  route: Route,
): Page =>
  route.kind === "node"
    ? { kind: "node", zoomed: zoom(derived, route.id) }
    : {
      kind: "outline",
      requested: route.file,
      file: route.file === null
        ? files[0]
        : files.includes(route.file)
        ? route.file
        : undefined,
    }

/** The outline the open page belongs to — the sidebar entry to light up. A
 *  zoomed node belongs to the file its CANONICAL record is in, whichever file
 *  the mirror that was clicked lived in. */
export const outlineOf = (page: Page): string | undefined =>
  page.kind === "outline"
    ? page.file
    : page.zoomed.kind === "node"
    ? page.zoomed.shows.file
    : undefined
