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
 * A route is what the address SAYS and a page is what it named; what that page
 * has PUT ON THE SCREEN is a third question, and {@link Drawn} is where it is
 * answered — because that, rather than the page, is what a filter narrows.
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

import type {
  Agenda,
  BrokenFile,
  DayGroup,
  Derived,
  Face,
  FileKind,
  Row,
  Zoomed,
} from "@olai/format"
import {
  bodyKind,
  dailyNotesOn,
  datedOn,
  fileKind,
  isArchived,
  rowsOf,
  rowsUnder,
  zoom,
} from "@olai/format"

import { atElement, type Route } from "./routes.ts"

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

/**
 * The set, as the page model reads it: what was found, and what could not be
 * read. One argument rather than two, because they are one snapshot and a
 * caller cannot hand over half of it.
 *
 * ONE COLLECTION, which is the arc's own ruling arriving in the browser: this
 * was `files` (the outlines) beside `documents` (the bodied ones), two lists
 * of paths, and every question below picked whichever it happened to be
 * thinking about. A FACE says what a file is — its path, its title, the
 * addresses it points at, the tags it writes (`@olai/format`) — and which KIND
 * it is, is the suffix's answer, asked where it is needed rather than stored
 * as a second list.
 *
 * They arrive on two collections and always will: an outline's records travel
 * with it and a document's body does not (`@olai/surface`). That is a fact
 * about COST, and it stops here — what the pages are asked is one list.
 */
export interface Found {
  /** Every served file, as its face, in path order. */
  readonly documents: ReadonlyArray<Face>
  readonly broken: ReadonlyMap<string, BrokenFile>
}

/** The face of one served path, or `undefined` for a path this directory does
 *  not hold — the membership question every arm below asks, in the form that
 *  hands back what it then wants to know. */
const faceAt = (found: Found, path: string): Face | undefined =>
  found.documents.find((face) => face.path === path)

/** The OUTLINES' paths, in path order — what the trash reads and what the
 *  front page picks its first file from. A narrowing of the one collection
 *  rather than a list beside it: asking says which files are being left out. */
const outlinesOf = (found: Found): ReadonlyArray<string> =>
  found.documents.flatMap((face) => (fileKind(face.path) === "outline" ? [face.path] : []))

export const pageOf = (
  derived: Derived,
  found: Found,
  route: Route,
  /** What day it is, as text. The one thing here that is not a fact about the
   *  set — and the only reason `/today` can be an address rather than a
   *  redirect that would put yesterday in someone's history. */
  today: string,
): Page => {
  // THE PAGES THIS APP CLAIMED BY NAME FIRST, and then the grammar — the same
  // reading order the parser uses (`./routes.ts`'s `routeNamed`), because it
  // is the same precedence: a computed page is a word this app took, and an
  // address is everything else. They cannot collide, so the order is a reading
  // order rather than a rule.
  if (route.kind === "agenda") return { kind: "agenda", date: today }
  if (route.kind === "trash") return trashOf(found)
  if (route.kind === "day" || route.kind === "today") {
    const date = route.kind === "today" ? today : route.date
    return {
      kind: "day",
      date,
      groups: datedOn(derived, date),
      // A day's note is found by the NAME of a file rather than by anything in
      // the set, which is why this arm reads the directory for something other
      // than existence.
      notes: dailyNotesOn(found.documents.map((face) => face.path), date),
    }
  }

  // WHICH PAGE AN ADDRESS OPENS IS DECIDED HERE, and nowhere else — which is
  // what the route's arms collapsing bought (`./routes.ts`). Three questions,
  // in the order the grammar asks them: a node is an element with no document;
  // a heading is in a BODY by construction; and a path with no element is
  // whatever its suffix says — an outline is a tree of rows, everything else
  // with a body is drawn whole. Nothing upstream stored that answer, so
  // nothing upstream can disagree with it.
  const address = route.address
  if (address?.kind === "node") {
    return { kind: "node", zoomed: zoom(derived, address.id) }
  }

  if (address !== null && (address.kind === "heading" || bodyKind(address.path) !== null)) {
    // The place INSIDE the page is not carried onto the arm, and that is the
    // model's own rule kept: an arm holds what its screen needs. What the
    // screen needs is the LANDING, which is an act rather than a fact — it
    // happens once, on arrival, and never again on a re-render — so it comes
    // from the router that caused the navigation (`./router.tsx`'s `landing`).
    const file = address.path
    return faceAt(found, file) !== undefined
      ? { kind: "document", file }
      // The kind the reader ASKED FOR, off the name the address spelled — so
      // "no such document" and "no such saved page" send them to two different
      // places. `?? "document"` is unreachable (a suffix the registry claims is
      // what makes a path an address at all) and is kept honest rather than
      // asserted away.
      : { kind: "nothing", sought: bodyKind(file) ?? "document", requested: file }
  }

  // What is left is an OUTLINE, or the front page — which is whichever outline
  // was found first, skipping the archives, since those are the trash's to show
  // and nobody's front page. A named one has to be served, and naming an
  // archive opens the trash: an archive is not a place you edit, so the address
  // a sidebar used to link goes where the entry went.
  const outlines = outlinesOf(found)
  const named = address === null ? null : address.path
  const file = named === null
    ? outlines.find((candidate) => !isArchived(candidate))
    : outlines.includes(named)
    ? named
    : undefined
  if (file === undefined) {
    return {
      kind: "nothing",
      sought: "outline",
      requested: outlines.length === 0 ? null : named,
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
  files: outlinesOf(found).filter(isArchived),
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
 * ONE LIST and one question asked of the SUFFIX, which is what says which page
 * a path opens: the registry gives each kind exactly one suffix, so nothing
 * here is a precedence between two lists that could both hold a path.
 *
 * A FRAGMENT rides only on the document arm, and its absence on the outline arm
 * is a fact about outlines rather than an omission: a document page draws a
 * rendered body with ids in it, and an outline draws a tree of rows whose
 * addresses are node ids — which is why a `#` after an outline IS a node in
 * the address grammar, and why one arriving here with an outline path is
 * dropped rather than carried to a page that would ignore it.
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
  faceAt(found, path) === undefined ? undefined : atElement(path, at ?? null)

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

/** One archive, and the rows it holds — the trash's own group, and named for
 *  `DayGroup` because it is the same shape and the same idea: a file heading
 *  and what is under it. What makes it the trash's rather than the sidebar's is
 *  that the file is an `Archive.olai` (`isArchived`). */
export interface TrashGroup {
  readonly file: string
  readonly rows: ReadonlyArray<Row>
}

/**
 * WHAT THE OPEN PAGE DRAWS — in the one shape a filter can narrow and count.
 *
 * `Page` says which page the address turned out to name; this says what that
 * page has PUT ON THE SCREEN, which is a different question and the one the
 * filter asks. Every page here is a query already — an outline is the tree of a
 * file, a day is every node on a date, the agenda is the same dates read
 * forward, the trash is every archive — and narrowing one is taking rows out of
 * an answer somebody is looking at. So the filter never re-asks the page's
 * question: it is handed the answer and prunes it (`filter/narrowing.ts`).
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
 *  frame before the set has been read at all (`./App.tsx`), which is the same
 *  nothing. */
export const NOTHING_DRAWN: Drawn = { kind: "none" }

/**
 * The page's own answer, whichever page it is.
 *
 * The AGENDA arrives as an argument rather than being read here, and that is
 * the same division `page.ts` already keeps for it: what is owed is one reading
 * of the set at today, held in `App.tsx` because the directory column marks it
 * on every screen, and a second `agendaOf` under the page model would be the
 * second derivation those two are forbidden to have.
 *
 * `undefined` for the frame before that reading exists draws an empty agenda
 * rather than `none`: the page is the agenda, it simply has nothing yet, and
 * `none` would take the filter box off the screen for a frame.
 */
export const drawnBy = (
  derived: Derived,
  page: Page | undefined,
  agenda: Agenda | undefined,
): Drawn => {
  if (page === undefined) return NOTHING_DRAWN
  if (page.kind === "outline" || page.kind === "node") {
    return { kind: "tree", rows: rowsFor(derived, page) }
  }
  if (page.kind === "day") {
    return { kind: "day", groups: page.groups, notes: page.notes }
  }
  if (page.kind === "agenda") {
    return { kind: "agenda", agenda: agenda ?? NOTHING_OWED }
  }
  if (page.kind === "trash") {
    return { kind: "trash", files: page.files, groups: archivesOf(derived, page) }
  }
  return NOTHING_DRAWN
}

/** An agenda nobody has read yet. The three empty sections a page draws nothing
 *  from — never a claim, which is the rule every readout of what is owed keeps
 *  (`agenda/owed.ts`). */
const NOTHING_OWED: Agenda = { overdue: [], today: [], upcoming: [] }

/**
 * The archives the trash draws, each with its rows.
 *
 * ONLY THE ONES WITH ANYTHING IN THEM: an archive emptied by put-backs draws
 * nothing, exactly like one that never existed — so "the trash is empty" is
 * this list being empty rather than a second predicate. It was the trash page's
 * own memo and moved here for the reason the day's groups are on the page
 * model: what a page draws is decided in one place, and the filter has to be
 * able to prune and count it without re-deriving it.
 */
const archivesOf = (
  derived: Derived,
  page: Extract<Page, { kind: "trash" }>,
): ReadonlyArray<TrashGroup> =>
  page.files
    .map((file) => ({ file, rows: rowsOf(derived, file) }))
    .filter((group) => group.rows.length > 0)
