/**
 * The page a route asks for, and what the answer put on the screen.
 *
 * WHAT A PAGE IS is not decided here any more, and that is PR 10 of
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`: this module used to hold `pageOf`,
 * a pure function over the tab's own copy of every record in the directory, and
 * `drawnBy` beside it walking that copy again for the rows. The copy is gone.
 * What is left is the two ends of the seam it became — the QUESTION a route
 * turns into ({@link requestFor}) and the READING the server sends back, folded
 * into the one shape a filter can narrow and count ({@link drawnBy}).
 *
 * A route is text; a page is what that text turned out to name; what that page
 * put on the screen is a third question. The first is `./routes.ts`'s, the
 * second and third are `@olai/format`'s `page.ts` — answered where the set is —
 * and this module is what stands between them and the components.
 *
 * Core translates file, node and trash routes here. A mounted plugin translates
 * its own routes directly in `PageView`, so core never has to learn their page
 * vocabulary.
 */

import type {
  Agenda,
  DayGroup,
  Row,
  Shown,
  TrashGroup,
} from "@olai/format"
import type { CorePageRequest } from "@olai/surface"

import { atElement, type Route } from "./routes.ts"

/**
 * WHAT THE SERVER IS ASKED, for the route this pane is showing.
 *
 * File and node addresses are handed over as the parser read them. Trash is
 * core's one computed page; plugin routes bypass this function and ask their
 * sibling streams directly.
 *
 * THE NARROWING IS DROPPED, deliberately: a `?q=` is a second question with a
 * door of its own (`./filter/asking.ts`), so a page reading that carried it
 * would re-ask the whole page on every keystroke.
 */
export const requestFor = (route: Route): CorePageRequest => {
  switch (route.kind) {
    case "at": {
      const address = route.address
      // A HEADING IS NOT A PAGE, and neither is a ROW — and dropping both
      // here is the page model's own rule kept where it now matters: an arm
      // holds what its screen needs, and what a `#element` decides is where
      // the reader LANDS — an act, once, on arrival, answered by the
      // router (`./router.tsx`'s `landing`). Sent, it would make two links to
      // one document two different questions, and the subscription would
      // re-open for the second: the pane blanks, the body unmounts, and the
      // element being scrolled to goes with it.
      //
      // A bare NODE keeps its element, because for a node the element IS the
      // page.
      return {
        kind: "at",
        address: address?.kind === "heading" || address?.kind === "row"
          ? { kind: "document", path: address.path }
          : address,
      }
    }
    case "trash":
      return { kind: "trash" }
    case "plugin":
      // A mounted route tenant supplies its own request in PageView. This arm
      // is only the total fallback for a route whose tenant disappeared.
      return { kind: "at", address: null }
  }
}

/**
 * WHERE A PATH OF THIS VAULT OPENS — the route that draws the file at `path`,
 * or nothing at all for a path this directory does not hold.
 *
 * It is the same membership the page reading requires before it will draw
 * either page, asked one step earlier and for a caller that has a PATH rather
 * than an address. That caller is the `.html` preview: a reader clicks a link
 * inside somebody's saved page, the seal hands the path out, and the app has to
 * decide both whether it holds that file and which of its two page shapes the
 * file is (`../document/Hypertext.tsx`).
 *
 * ASKED OF THE PATHS, which is what a browser still holds of the directory: one
 * head per served file, no records and no bodies (`@olai/surface`'s `heads`).
 * Membership was always this question; what changed is that the list it is
 * asked of no longer arrives with every record in it. It took the FACES until
 * `perf-faces-broken-walk` and read `face.path` off every one of them to answer
 * — the directory hands the paths over now (`./directory.ts`), since that was
 * the only thing any reader of that list ever wanted.
 *
 * A FRAGMENT rides on both element arms, and that is the address grammar's
 * own answer rather than this function's: in a body it is a heading the
 * document face lands on, and after an outline it is a ROW, which is the
 * outline's landing. It came back whole from the grammar since the outline
 * arm gained its own (`./landing.ts`) — before, the qualified spelling was
 * discarded into a bare node on the way in, and the only fragment an outline
 * path could make was a zoom.
 */
export const opensAt = (
  paths: ReadonlyArray<string>,
  path: string,
  at?: string,
): Route | undefined => paths.includes(path) ? atElement(path, at ?? null) : undefined

/** The file the open page belongs to — the sidebar entry to light up. A zoomed
 *  node belongs to the file its CANONICAL record is in, whichever file the
 *  mirror that was clicked lived in; a document belongs to itself. */
export const fileOf = (shows: Shown): string | undefined => {
  if (shows.kind === "outline") return shows.file
  if (shows.kind === "document") return shows.file
  if (shows.kind === "broken") return shows.file.file
  if (shows.kind === "node" && shows.zoomed.kind === "node") return shows.zoomed.shows.file
  return undefined
}

/**
 * WHAT THE OPEN PAGE DRAWS — in the one shape a filter can narrow and count.
 *
 * The reading says which page the address turned out to name and everything it
 * holds; this says what of that is ROWS, in the shape the filter prunes. Every
 * page is a query already — an outline is the tree of a file, a day is every
 * node on a date, the agenda is the same dates read forward, the trash is every
 * archive — and narrowing one is taking rows out of an answer somebody is
 * looking at. So the filter never re-asks the page's question: it is handed the
 * answer and prunes it (`filter/narrowing.ts`).
 *
 * FOUR SHAPES rather than one, because there are four and pretending otherwise
 * would cost more than it saved: a tree nests and keeps ancestors, a day and
 * the agenda are flat rows already carrying their own ancestry, and the trash
 * is a tree per archive. `none` is a page a filter has nothing to narrow — a
 * document (prose, which this grammar says nothing about), a file that would
 * not parse, an address that named nothing — and it is what the filter bar is
 * drawn on the absence of, so the box appears exactly where it can do
 * something.
 */
export type Drawn =
  /** An outline's roots, or a zoomed node's children — one shape, because a
   *  file is the widest zoom there is. */
  | { readonly kind: "tree"; readonly rows: ReadonlyArray<Row> }
  /** A day's dated nodes AND the note somebody wrote on it, because both are
   *  on the screen and a filter takes one of them away (`filter/narrowing.ts`
   *  says why prose can never be a match). */
  | {
    readonly kind: "day"
    readonly groups: ReadonlyArray<DayGroup>
    readonly notes: ReadonlyArray<string>
  }
  | { readonly kind: "agenda"; readonly agenda: Agenda }
  /** The archives with rows in them, and the FILES the directory holds —
   *  which is not the same list: what is drawn narrows with the query, and
   *  whether a pile is worth a file heading is a fact about the directory
   *  (`trash/TrashPage.tsx`). */
  | {
    readonly kind: "trash"
    readonly files: ReadonlyArray<string>
    readonly groups: ReadonlyArray<TrashGroup>
  }
  | { readonly kind: "none" }

/** Nothing to narrow, as one value: `none` carries nothing, so a fresh object
 *  per frame would be a new value every revision for every page that has no
 *  filter — and the memo over it would publish on each one. Public for the
 *  frame before the reading has arrived at all, which is the same nothing. */
export const NOTHING_DRAWN: Drawn = { kind: "none" }

/**
 * The page's own rows, whichever page it is — read OFF the reading rather than
 * derived beside it.
 *
 * Every arm here used to be a walk: `rowsOf` for an outline, `rowsUnder` for a
 * zoom, `rowsOf` per archive for the trash, all over the tab's copy of the set.
 * They are the same walks and the same answers; they run where the set is, and
 * this reads the field they landed in.
 *
 * A ZOOMED NODE's rows are its `children`, which is the one place that reading
 * stopped being computed twice: `zoom` already walks them for the page, and
 * this module used to call `rowsUnder` again to get the same array.
 */
export const drawnBy = (shows: Shown | undefined): Drawn => {
  if (shows === undefined) return NOTHING_DRAWN
  if (shows.kind === "outline") return { kind: "tree", rows: shows.rows }
  if (shows.kind === "node") {
    return {
      kind: "tree",
      rows: shows.zoomed.kind === "node" ? shows.zoomed.children : [],
    }
  }
  if (shows.kind === "day") return { kind: "day", groups: shows.groups, notes: shows.notes }
  if (shows.kind === "agenda") return { kind: "agenda", agenda: shows.agenda }
  if (shows.kind === "trash") {
    return { kind: "trash", files: shows.files, groups: shows.groups }
  }
  return NOTHING_DRAWN
}
