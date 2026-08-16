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
 * component re-decides what it is looking at. Two things are the exception and
 * for opposite reasons: the ROWS, because {@link rowsFor} says why, and the
 * AGENDA, because what is owed stopped being the agenda page's the day the
 * directory column started marking it — it is one reading of the set at today,
 * held where both readers can see it (`./App.tsx`), and the arm here spells only
 * the day it is answered for. Nothing about the format is decided here either:
 * `@olai/format` says what an id resolves to, which file a node lives in, what
 * a file's tree is and what is dated a given day; this picks the arm.
 */

import type { BrokenFile, DayGroup, Derived, FileKind, Row, Zoomed } from "@olai/format"
import {
  dailyNotesOn,
  bodyKind,
  datedOn,
  isArchived,
  rowsOf,
  rowsUnder,
  zoom,
} from "@olai/format"

import type { Route } from "./routes.ts"

export type Page =
  | { readonly kind: "outline"; readonly file: string }
  /** One document, drawn whole. It carries the PATH, because that is what this
   *  model knows: the directory's documents are known to every tab as paths,
   *  and a body travels to whoever opens one — so what is decided here is that
   *  the address names a document the directory HAS, and the reading of it
   *  belongs to the page that draws it. */
  | { readonly kind: "document"; readonly file: string }
  | { readonly kind: "node"; readonly zoomed: Zoomed }
  /** One day, whatever it holds: every node with a date on it — scheduled for
   *  it or marked on it — grouped by the outline it lives in. An empty
   *  `groups` is a day with nothing on it, which is a page that says so rather
   *  than a page that is missing. */
  | {
    readonly kind: "day"
    readonly date: string
    readonly groups: ReadonlyArray<DayGroup>
    /** The documents that ARE this day's note, by path — a `.md` named for
     *  the date itself, wherever it lives (`@olai/format`'s `noteDateOf`).
     *  Usually none or one; more than one is two files both claiming the day,
     *  and the page lists both rather than choosing. They JOIN the groups
     *  above and never replace them: a day is still a query, and this is what
     *  the reader wrote on it. */
    readonly notes: ReadonlyArray<string>
  }
  /** What is owed: the same dates read forward. It carries the DAY it is
   *  answered for, because `/agenda` spells no date and a page that says what
   *  is overdue owes the reader the day it is overdue as of — and it carries
   *  nothing else, which is the one arm that does not hold its own answer.
   *
   *  THE READING IS NOT THIS PAGE'S ANY MORE. The directory column marks the
   *  agenda on every screen (`./Sidebar.tsx`, `./layout/Rail.tsx`), so what is
   *  owed is a fact about the set at today rather than about the address that
   *  happens to be open — one `agendaOf` in `./App.tsx`, read by the page that
   *  lists it and the entry that marks it. Carrying a copy here would be the
   *  second derivation those two are forbidden to have. */
  | { readonly kind: "agenda"; readonly date: string }
  /** What was put away: every archive the directory holds, in path order — an
   *  EMPTY list is a real page (nothing has been archived yet), never a
   *  missing one. Read-only by design: the one verb its rows offer is the way
   *  back out, and the archive tool re-creates the file on first use, so an
   *  absent archive and an empty trash are the same sight. */
  | { readonly kind: "trash"; readonly files: ReadonlyArray<string> }
  /** An outline whose file did not parse: it has no tree to draw, so its own
   *  pane carries its errors instead. Every other outline is unaffected. */
  | { readonly kind: "broken"; readonly file: BrokenFile }
  /** Nothing to show. `requested` is the file the URL named and the directory
   *  does not have — `null` when the directory has no outlines at all, which
   *  is a different thing to tell the reader — and `sought` is what it was
   *  looking for, because "no such outline" and "no such document" send a
   *  reader to two different places. It is the FORMAT's kind, read off the
   *  name the address spelled, so the sentence names the thing the reader asked
   *  for rather than the collection this model happened to look in. */
  | {
    readonly kind: "nothing"
    readonly sought: FileKind
    readonly requested: string | null
  }

/** The set, as the page model reads it: what was found, and what could not be
 *  read. One argument rather than three, because they are one snapshot and a
 *  caller cannot hand over half of it. */
export interface Found {
  readonly files: ReadonlyArray<string>
  /** The BODIED files' paths — every `.md` and every `.html` the directory
   *  holds, in the order the sidebar draws them. The same shape `files` has,
   *  and asked the same question: does the directory hold the file this address
   *  names. Named for the collection they arrive on, which is the wire's own
   *  name for "a file whose body is read one at a time". */
  readonly documents: ReadonlyArray<string>
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
    // The place inside the page is NOT carried here, and that is the model's
    // own rule kept: an arm holds what its screen needs. What the screen needs
    // is the LANDING, which is an act rather than a fact — it happens once, on
    // arrival, and never again on a re-render — so it comes from the router
    // that caused the navigation (`./router.tsx`'s `landing`) rather than from
    // a fragment this would hand out afresh every frame.
    return found.documents.includes(route.file)
      ? { kind: "document", file: route.file }
      // Asked of `bodyKind` rather than `fileKind`: this address opens the files
      // that HAVE a page, so `/doc/plan.olai` is a reader who meant a document
      // and not a screen that says "no outline named plan.olai" about an outline
      // the directory is serving. `/doc/nowhere.txt` names no kind at all and
      // lands in the same place, for the same reason.
      : { kind: "nothing", sought: bodyKind(route.file) ?? "document", requested: route.file }
  }

  if (route.kind === "agenda") return { kind: "agenda", date: today }

  if (route.kind === "trash") return trashOf(found)

  if (route.kind === "day" || route.kind === "today") {
    const date = route.kind === "today" ? today : route.date
    return {
      kind: "day",
      date,
      groups: datedOn(derived, date),
      // The PATHS the directory has, which is the same list this function
      // already asks "is that a document" of below. A day's note is found by
      // the name of a file rather than by anything in the set, so it is the
      // one arm that reads `found` for something other than existence.
      notes: dailyNotesOn(found.documents, date),
    }
  }

  // `/` is whichever outline was found first — skipping the archives, which
  // are the trash's to show and nobody's front page. A named one has to be
  // served, and naming an archive opens the trash: an archive is not a place
  // you edit, so the address a sidebar used to link goes where the entry went.
  const file = route.file === null
    ? found.files.find((candidate) => !isArchived(candidate))
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
  if (isArchived(file)) return trashOf(found)
  const unreadable = found.broken.get(file)
  return unreadable === undefined
    ? { kind: "outline", file }
    : { kind: "broken", file: unreadable }
}

/** The trash page: the archives the directory holds, in the path order the
 *  sidebar sorts by. One spelling for the route and for an archive's own
 *  address, so the two doors cannot show two different trashes. */
const trashOf = (found: Found): Page => ({
  kind: "trash",
  files: found.files.filter(isArchived),
})

/**
 * WHERE A PATH OF THIS VAULT OPENS — the route that draws the file at `path`,
 * or nothing at all for a path this directory does not hold.
 *
 * It is the same membership {@link pageOf} requires before it will draw either
 * page, asked one step earlier and for a caller that has a PATH rather than an
 * address. That caller is the `.html` preview: a reader clicks a link inside
 * somebody's saved page, the seal hands the path out, and the app has to decide
 * both whether it holds that file and which of its two page shapes the file is
 * (`../document/Hypertext.tsx`). Asked here rather than there, because "which
 * route opens this file" is exactly what this module already answers for every
 * address, and a second answer beside the frame would be free to disagree with
 * the one the page model then applies to the route it produced.
 *
 * TWO LISTS, in the order a path can only be in one of: `documents` is every
 * bodied file and `files` is every outline, and no path is in both — the suffix
 * decides which, and the registry gives each kind exactly one. So the order is
 * not a precedence, it is a spelling.
 *
 * A FRAGMENT rides only on the document arm, and its absence on the outline arm
 * is a fact about outlines rather than an omission: `/doc/` draws a rendered
 * body with ids in it, and `/o/` draws a tree of rows whose addresses are node
 * ids — a `#section` means nothing there, so it is dropped rather than carried
 * to a page that would ignore it.
 *
 * NOT a membership test with a route bolted on afterwards, which is the shape
 * this replaces: the caller asked one list, got a boolean, and then built the
 * route itself — which worked only while there was one kind of page to build.
 */
export const opensAt = (
  found: Found,
  path: string,
  at?: string,
): Route | undefined =>
  found.documents.includes(path)
    ? { kind: "document", file: path, ...(at === undefined ? {} : { at }) }
    : found.files.includes(path)
    ? { kind: "outline", file: path }
    : undefined

/** The file the open page belongs to — the sidebar entry to light up, in
 *  whichever of its two lists. A zoomed node belongs to the file its CANONICAL
 *  record is in, whichever file the mirror that was clicked lived in; a
 *  document belongs to itself. */
export const fileOf = (page: Page): string | undefined => {
  if (page.kind === "outline") return page.file
  if (page.kind === "document") return page.file
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
