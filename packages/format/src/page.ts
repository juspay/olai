/**
 * WHAT ONE PAGE SHOWS — the reading a browser is handed, in place of the vault
 * it used to walk.
 *
 * This is `docs/brainstorming/vault-in-browser.md` §3's table, written down as
 * a value: an address goes in, and what the page draws comes out. Every arm is
 * built from the reading functions this package already had — `rowsOf`, `zoom`,
 * `datedOn`, `dailyNotesOn`, `agendaOf`, `backlinksOf`, `referrersTo` — and not
 * one of them was rewritten. They are simply CALLED on the side that holds the
 * set, and their answer put on the wire (§2: "nothing gets rewritten; it gets
 * called on the other side").
 *
 * ## Why the whole answer is one value
 *
 * Because it is one QUESTION. A page is a query — an outline is a file's tree,
 * a day is every node on a date, the agenda is those dates read forward, the
 * trash is every archive — and asking it in pieces would be a browser holding
 * half a page while it waited for the rest, with nothing saying which revision
 * either half was about. One reading is one moment of the directory.
 *
 * It is also what makes a re-answer cheap to decide: the server recomputes this
 * on every published revision and sends it only when it changed BY VALUE
 * ({@link samePageReading}), which is the mechanism §2 names and the one the
 * `pins` cell and the two date streams already work by.
 *
 * ## What is NOT decided here
 *
 * WHICH PAGE AN ADDRESS OPENS, in the app's sense, is still the browser's — and
 * that seam is `./shelf.ts`'s, unchanged. The app claims words of its own
 * (`/d/…`, `/today`, `/agenda`, `/trash`) that this grammar cannot see, so what
 * arrives here is a REQUEST that has already been read by the parser that
 * printed it ({@link PageRequest}): the browser says "the agenda, as of this
 * day" or "this address", and the set answers what that names. Nothing here
 * parses a URL.
 *
 * WHAT A READER HAS HIDDEN is not here either, and deliberately: done-hiding
 * and the filter box both prune what is on screen, and both are the reading's
 * readers rather than the reading ({@link Row}'s `under` exists precisely
 * because a write must be counted against the SET and not against what survived
 * those two).
 *
 * ## The names table, which is the tail §2 warned about
 *
 * A row's title, a `see`, an `after` and a `blocked by` all point at a node by
 * ID, and what each one DRAWS is that node's title right now — which is a fact
 * about the vault, not about the page. The browser resolved those against its
 * own copy of the set (`@olai/web`'s `edges/named.ts`, `address/address.ts`'s
 * `shownIn`); there is no copy any more, so the ids a page mentions are
 * resolved here and travel WITH it ({@link PageReading.names}). One entry per
 * id however many rows point at it, which is why it is a table beside the arms
 * rather than a field repeated inside them.
 */

import { Schema } from "effect"

import { Address } from "./address.ts"
import { Agenda, agendaOf } from "./agenda.ts"
import { Backlink, backlinksOf, Referrer, referrersTo } from "./backlinks.ts"
import { dailyNotesOn, DayGroup, datedOn } from "./dates.ts"
import { type Derived, type InTheWay, nodeNamed, nodesOf, Row, rowsOf } from "./derive.ts"
import type { Face } from "./document.ts"
import { bodyKind, FileKind, fileKind } from "./kinds.ts"
import { isPutAway, isTrashed, type LocatedRegular } from "./node.ts"
import { BrokenFile } from "./set.ts"
import { pinTargetIn } from "./shelf.ts"
import { Zoomed, zoom } from "./zoom.ts"

/**
 * WHICH PAGE IS BEING ASKED FOR — the browser's route, with everything the
 * grammar down here cannot read already read.
 *
 * Four arms where the app has six routes, and the two that collapse are the
 * ones that name a day: `/today` IS `/d/<the day it is>`, and the only
 * difference between them is who says which day it is. That is a clock, the
 * reader's own, and it is answered where the reader is — so `today` reaches
 * this side as a date on the arm that needs one, and the agenda's own arm
 * carries the day it is counted against for the same reason `OwedRequest` does:
 * what is late is late where the person is standing.
 *
 * THE FILTER IS NOT HERE. A `?q=` narrows what is drawn, and narrowing is a
 * second question with a door of its own (`search.matching`) — asked of the
 * whole set rather than of a page, debounced, and answered as ids to look up.
 * A page reading that took the query would be that door built twice.
 */
export const PageRequest = Schema.Union([
  /** An address in the served directory — `null` for the front page, which
   *  names none ("whichever outline was found first"). */
  Schema.Struct({ kind: Schema.Literal("at"), address: Schema.NullOr(Address) }),
  /** One day of the journal, by its ISO date — `/d/<date>` and `/today` both. */
  Schema.Struct({ kind: Schema.Literal("day"), date: Schema.String }),
  /** What is owed, read forward from the reader's own today. */
  Schema.Struct({ kind: Schema.Literal("agenda"), today: Schema.String }),
  /** Everything that was put away. */
  Schema.Struct({ kind: Schema.Literal("trash") }),
])
export type PageRequest = typeof PageRequest.Type

/** One archive and the rows it holds — the trash's own group, named for
 *  {@link DayGroup} because it is the same shape and the same idea: a file
 *  heading and what is under it. */
export const TrashGroup = Schema.Struct({
  file: Schema.String,
  rows: Schema.Array(Row),
})
export type TrashGroup = typeof TrashGroup.Type

/**
 * ONE ID THIS PAGE POINTS AT, and what the set says it names.
 *
 * The id is the KEY and it travels beside the name, which is `./shelf.ts`'s
 * rule read once more and for its reason: the drawing side reads the same
 * titles with a parser of its own, so a name is spent only where the two agree
 * about which node was addressed.
 *
 * `file` rides along because a link says where it goes: a `see` drawn on a row
 * points at the outline the target lives in, and it was `nodeNamed(...).file`
 * when the browser had a set to ask.
 */
export const Named = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  file: Schema.String,
})
export type Named = typeof Named.Type

/**
 * WHAT THE ADDRESS TURNED OUT TO NAME, and what it put on the screen.
 *
 * The union the browser's page model used to compute, with the rows folded IN
 * rather than derived a second time beside it: what a page IS and what it has
 * DRAWN were two questions in the browser because the answer to the second was
 * cheap once you held the vault. Here they are one answer, because the walk
 * that decides the arm is the walk that produces the rows.
 */
export const Shown = Schema.Union([
  /** One outline, drawn as a tree — its roots expanded, mirrors followed into
   *  their target files. */
  Schema.Struct({
    kind: Schema.Literal("outline"),
    file: Schema.String,
    rows: Schema.Array(Row),
  }),
  /** One node as a page: the heading with its crumbs and its edges, the rows
   *  under it, and who refers to it. */
  Schema.Struct({
    kind: Schema.Literal("node"),
    zoomed: Zoomed,
    /** What refers to this node, in corpus order — empty for an id nothing
     *  points at, and for the three arms of {@link Zoomed} that show no node. */
    backlinks: Schema.Array(Backlink),
  }),
  /**
   * One document, drawn whole. It carries the PATH and never the body: a body
   * travels per key on its own collection, read by whoever opens one, which is
   * the arrangement this whole design generalises.
   */
  Schema.Struct({
    kind: Schema.Literal("document"),
    file: Schema.String,
    /** Who points at this document — the "referred to by" list. */
    referrers: Schema.Array(Referrer),
  }),
  /** One day, whatever it holds: every node with a date on it — scheduled for
   *  it or marked on it — grouped by the outline it lives in. An empty
   *  `groups` is a day with nothing on it, which is a page that says so rather
   *  than a page that is missing. */
  Schema.Struct({
    kind: Schema.Literal("day"),
    date: Schema.String,
    groups: Schema.Array(DayGroup),
    /** The documents that ARE this day's note, by path — a `.md` named for the
     *  date itself, wherever it lives. Usually none or one; more than one is
     *  two files both claiming the day, and the page lists both rather than
     *  choosing. They JOIN the groups above and never replace them. */
    notes: Schema.Array(Schema.String),
  }),
  /** What is owed: the same dates read forward. It carries the DAY it is
   *  answered for, because `/agenda` spells no date and a page that says what
   *  is overdue owes the reader the day it is overdue as of. */
  Schema.Struct({
    kind: Schema.Literal("agenda"),
    date: Schema.String,
    agenda: Agenda,
  }),
  /**
   * What was put away: every archive the directory holds, in path order, and
   * the rows of the ones that hold anything.
   *
   * `files` and `groups` are NOT the same list, and the difference is the page:
   * an archive emptied by put-backs draws nothing, exactly like one that never
   * existed, so "the trash is empty" is `groups` being empty — while whether
   * the directory HAS archives is `files`.
   */
  Schema.Struct({
    kind: Schema.Literal("trash"),
    files: Schema.Array(Schema.String),
    groups: Schema.Array(TrashGroup),
    /**
     * How many RECORDS emptying it would delete, across every archive —
     * including the ones with no rows drawn, and including each archive's own
     * signpost titles.
     *
     * The count the confirm has to name, and it is the set's rather than the
     * page's for two independent reasons, either of which alone would make a
     * count read off the rows an understatement: the filter box narrows this
     * page like any other, and a mirror inside an archive draws the children of
     * a live outline's node, which emptying does not touch.
     */
    records: Schema.Int,
  }),
  /** An outline whose file did not parse: it has no tree to draw, so its own
   *  pane carries its errors instead. Every other outline is unaffected. */
  Schema.Struct({ kind: Schema.Literal("broken"), file: BrokenFile }),
  /** Nothing to show. `requested` is the file the address named and the
   *  directory does not have — `null` when the directory has no outlines at
   *  all, which is a different thing to tell the reader — and `sought` is what
   *  it was looking for, because "no such outline" and "no such document" send
   *  a reader to two different places. */
  Schema.Struct({
    kind: Schema.Literal("nothing"),
    sought: FileKind,
    requested: Schema.NullOr(Schema.String),
  }),
])
export type Shown = typeof Shown.Type

/**
 * ONE PAGE'S DATA, and the law says at most this: what it shows, and what the
 * ids it points at are called.
 */
export const PageReading = Schema.Struct({
  shows: Shown,
  /** Every node id this page mentions that the set declares, once each — see
   *  the names paragraph at the top of this module. An id the set does not
   *  declare is simply absent, which is the honest dead link: the drawing side
   *  falls back to the id, exactly as it did when it looked the id up itself. */
  names: Schema.Array(Named),
})
export type PageReading = typeof PageReading.Type

/**
 * Whether two readings say the same thing — what keeps a revision that changed
 * nothing on this page from sending a frame to the tab drawing it.
 *
 * DERIVED from the schema, for `./shelf.ts`'s reason word for word: a
 * hand-written comparison would be the declaration above spelled a second time,
 * and the next field added would simply not be compared. The failure mode is a
 * frame that is never sent — a page holding a title the directory has moved
 * past, under a healthy socket.
 */
export const samePageReading: (a: PageReading, b: PageReading) => boolean = Schema
  .toEquivalence(PageReading)

/**
 * THE READING — what the address names, over the set as it stands.
 *
 * THE FACES as well as the derivation, because two of the questions here are
 * about FILES rather than about records: which paths the directory serves at
 * all, and which of them is a day's note. That is `Query.homes`' argument one
 * door along, and the near miss it exists to avoid.
 *
 * A `Document` IS a {@link Face} plus its content (`./document.ts` spreads the
 * face into every arm), so the caller hands the set's own documents over as
 * they stand — no projection per page per revision, and no second list to keep
 * in step with the one the directory was assembled from.
 */
export const readingOf = (
  derived: Derived,
  faces: ReadonlyArray<Face>,
  broken: ReadonlyArray<BrokenFile>,
  request: PageRequest,
): PageReading => {
  const shows = shownOf(derived, faces, broken, request)
  return {
    shows,
    names: namesFor(derived, shows, request.kind === "at" ? request.address : null),
  }
}

/** Whether the directory holds this path at all — the membership question every
 *  arm below asks, and the whole of what any of them wants: what the page then
 *  DRAWS is the file's own business. */
const serves = (faces: ReadonlyArray<Face>, path: string): boolean =>
  faces.some((face) => face.path === path)

/** The OUTLINES' paths, in path order — what the trash reads and what the front
 *  page picks its first file from. A narrowing of the one list rather than a
 *  list beside it: asking says which files are being left out. */
const outlinesAmong = (faces: ReadonlyArray<Face>): ReadonlyArray<string> =>
  faces.filter((face) => fileKind(face.path) === "outline").map((face) => face.path)

const shownOf = (
  derived: Derived,
  faces: ReadonlyArray<Face>,
  broken: ReadonlyArray<BrokenFile>,
  request: PageRequest,
): Shown => {
  // THE PAGES THE APP CLAIMED BY NAME FIRST, and then the address — the same
  // reading order the browser's parser uses, because it is the same precedence:
  // a computed page is a word that app took, and an address is everything else.
  // They cannot collide, so the order is a reading order rather than a rule.
  if (request.kind === "agenda") {
    return { kind: "agenda", date: request.today, agenda: agendaOf(derived, request.today) }
  }
  if (request.kind === "trash") return trashOf(derived, faces)
  if (request.kind === "day") {
    return {
      kind: "day",
      date: request.date,
      groups: datedOn(derived, request.date),
      // A day's note is found by the NAME of a file rather than by anything in
      // the set, which is why this arm reads the directory for something other
      // than existence.
      notes: dailyNotesOn(faces.map((face) => face.path), request.date),
    }
  }

  // WHICH PAGE AN ADDRESS OPENS, in the order the grammar asks: a node is an
  // element with no document; a heading is in a BODY by construction; and a
  // path with no element is whatever its suffix says — an outline is a tree of
  // rows, everything else with a body is drawn whole.
  const address = request.address
  if (address?.kind === "node") {
    const zoomed = zoom(derived, address.id)
    return {
      kind: "node",
      zoomed,
      backlinks: zoomed.kind === "node" ? backlinksOf(derived, zoomed.shows.node.id) : [],
    }
  }

  if (address !== null && (address.kind === "heading" || bodyKind(address.path) !== null)) {
    const file = address.path
    if (!serves(faces, file)) {
      // The kind the reader ASKED FOR, off the name the address spelled — so
      // "no such document" and "no such saved page" send them to two different
      // places. `?? "document"` is unreachable (a suffix the registry claims is
      // what makes a path an address at all) and is kept honest rather than
      // asserted away.
      return { kind: "nothing", sought: bodyKind(file) ?? "document", requested: file }
    }
    return { kind: "document", file, referrers: referrersTo(address, faces, derived) }
  }

  // What is left is an OUTLINE, or the front page — whichever outline was found
  // first, skipping the trash and leftover archives: the trash is the trash
  // page's to show, and a leftover is dormant, so neither is anybody's front
  // page. A named leftover still opens as an outline — that is how a human
  // hand-moves it. Naming the trash opens the trash: it is not a place you
  // edit, so the address a sidebar used to link goes where the entry went.
  const outlines = outlinesAmong(faces)
  const named = address === null ? null : address.path
  const file = named === null
    ? outlines.find((candidate) => !isPutAway(candidate))
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
  if (isTrashed(file)) return trashOf(derived, faces)
  const unreadable = broken.find((one) => one.file === file)
  return unreadable === undefined
    ? { kind: "outline", file, rows: rowsOf(derived, file) }
    : { kind: "broken", file: unreadable }
}

/** The trash page: the archives the directory holds, in the path order the
 *  sidebar sorts by, the rows of those that hold anything, and what emptying
 *  would take. One spelling for the route and for an archive's own address, so
 *  the two doors cannot show two different trashes. */
const trashOf = (derived: Derived, faces: ReadonlyArray<Face>): Shown => {
  const files = outlinesAmong(faces).filter(isTrashed)
  return {
    kind: "trash",
    files,
    groups: files
      .map((file) => ({ file, rows: rowsOf(derived, file) }))
      .filter((group) => group.rows.length > 0),
    records: files.reduce((count, file) => count + nodesOf(derived, file).length, 0),
  }
}

/**
 * EVERY ID THIS PAGE POINTS AT, resolved — the names table.
 *
 * Two kinds of pointer, and both are read off the records the reading already
 * carries rather than off the vault: the EDGE fields a node writes (`see`,
 * `after`), which a row draws as a strip of links; and an ADDRESS somebody
 * wrote INTO a title, which is the same reading the shelf is built out of
 * (`./shelf.ts`'s `pinTargetIn`) and the last address resolution the browser
 * was still doing locally.
 *
 * The REQUESTED address joins them, and it is the one entry that is not about a
 * row: the palette's pin row names the page it is standing on, and a `/#id`
 * page is called whatever that node is called right now.
 */
const namesFor = (
  derived: Derived,
  shows: Shown,
  address: Address | null,
): ReadonlyArray<Named> => {
  const wanted = new Set<string>()
  if (address?.kind === "node") wanted.add(address.id)
  for (const node of drawnIn(shows)) {
    for (const id of node.node.see ?? []) wanted.add(id)
    for (const id of node.node.after ?? []) wanted.add(id)
    const written = pinTargetIn(node.node.title)
    if (written !== undefined) wanted.add(written)
  }
  const named: Array<Named> = []
  for (const id of wanted) {
    // `nodeNamed` and not the index: an id may address a MIRROR, and what a
    // reader can be shown is the node standing at that placement — the same
    // lookup a `see` link's text has always come from.
    const found = nodeNamed(derived, id)
    if (found !== undefined) named.push({ id, title: found.node.title, file: found.file })
  }
  return named
}

/** Every regular record this reading carries, however deep — one walk over the
 *  arms, so a page that grows a place to draw a node grows a place to resolve
 *  what that node points at, in one edit rather than two. */
function* drawnIn(shows: Shown): Generator<LocatedRegular> {
  switch (shows.kind) {
    case "outline":
      yield* inRows(shows.rows)
      return
    case "node":
      if (shows.zoomed.kind === "node") {
        yield shows.zoomed.shows
        yield* shows.zoomed.trail
        yield* inWay(shows.zoomed.blocked)
        yield* inRows(shows.zoomed.children)
      }
      for (const backlink of shows.backlinks) yield backlink.at
      return
    case "document":
      for (const referrer of shows.referrers) {
        if (referrer.at !== undefined) yield referrer.at
      }
      return
    case "day":
      yield* inGroups(shows.groups)
      return
    case "agenda":
      for (const day of shows.agenda.overdue) yield* inGroups(day.groups)
      yield* inGroups(shows.agenda.today)
      for (const day of shows.agenda.upcoming) yield* inGroups(day.groups)
      return
    case "trash":
      for (const group of shows.groups) yield* inRows(group.rows)
      return
    case "broken":
    case "nothing":
      return
  }
}

function* inRows(rows: ReadonlyArray<Row>): Generator<LocatedRegular> {
  for (const row of rows) {
    if (row.kind === "node" || row.kind === "mirror") yield row.shows
    yield* inWay(row.blocked)
    yield* inRows(row.children)
  }
}

function* inGroups(groups: ReadonlyArray<DayGroup>): Generator<LocatedRegular> {
  for (const group of groups) {
    for (const entry of group.nodes) {
      yield entry.shows
      yield* entry.trail
      yield* inWay(entry.blocked)
    }
  }
}

/** What a place is waiting on is drawn as a link too, so what its title
 *  addresses is a name this page spends. */
function* inWay(blocked: ReadonlyArray<InTheWay>): Generator<LocatedRegular> {
  for (const one of blocked) yield one.at
}
