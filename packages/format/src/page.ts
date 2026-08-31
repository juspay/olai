/**
 * WHAT ONE PAGE SHOWS — the reading a browser is handed, in place of the vault
 * it used to walk.
 *
 * This is `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` §3's table, written down as
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
 *
 * A CUSTOM VALUE joins them since `props-doors-autoshow`, and it is the one
 * pointer that is a QUESTION rather than a declaration: `{"reviewer":"pi"}` is
 * a string that might be a node's id, and only the set can say. See
 * {@link namesFor}, where that difference is argued.
 *
 * ## ...and the doors table beside it, which is that tail read once more
 *
 * The same shape for the same reason, one question over: what a property value
 * NAMES is a fact about the vault — its declarations, its ids, the files it
 * serves — and the browser holds none of the three. It used to guess, from the
 * value's shape, and the guesses were wrong in three ways that were each a live
 * bug (`@olai/format`'s `meaning.ts` names them). So the question is answered
 * where the set is and its ANSWERS travel ({@link PageReading.doors}), exactly
 * as resolved names do.
 *
 * ## ...and the LICENCES table beside THAT, which is the same walk's other half
 *
 * A value may also be CLAIMED — by a word a plugin taught this vault, declared
 * on the key it sits under, on a serve that is running the plugin that answers
 * for it. That conjunction is what licences a live FACE (a terminal door, a CI
 * chip), and it was the last thing in olai a browser decided for itself: the
 * dressing table was looked up by the property KEY, because the key is all a
 * tab has, while the server's walk and value gate followed the declared KIND.
 * A vault declaring `terminal` on a key called `pty` was therefore probed,
 * gated, and drawn as nothing.
 *
 * So the WORD travels, as {@link PageReading.licences}, minted by the very same
 * consult that mints the doors ({@link answersFor} — one walk, one dedupe, two
 * tables). It is an answer about one drawn value and not the declaration it was
 * read from, which is what makes it the same kind of thing as a name and a door
 * rather than a hole in the paragraph below.
 *
 * WHAT DOES NOT TRAVEL is the vocabulary itself. A declarations cell beside the
 * page was the refused alternative and #395's exclusion survives untouched: the
 * tab receives what each value turned out to name and what claims it, never the
 * rules that decided either, so nothing up there can re-derive an answer and
 * disagree.
 */

import { Schema } from "effect"

import { Address } from "./address.ts"
import { Agenda, type AgendaDay, agendaOf } from "./agenda.ts"
import { Backlink, backlinksOf, Referrer, referrersTo } from "./backlinks.ts"
import { Custom, customOf } from "./custom.ts"
import { dailyNotesOn, DayGroup, datedOn } from "./dates.ts"
import { type Derived, type InTheWay, nodeNamed, nodesOf, Row, rowsOf } from "./derive.ts"
import type { Face } from "./document.ts"
import { bodyKind, FileKind, fileKind } from "./kinds.ts"
import { consult, Door, Licence, type Vault } from "./meaning.ts"
import { ID_SHAPE, isPutAway, isTrashed, type LocatedRegular, propertiesIn } from "./node.ts"
import { markdownPaths } from "./rules.ts"
import { BrokenFile } from "./set.ts"
import { pinTargetIn } from "./shelf.ts"
import { declarationsIn, type KindVocabulary, NO_KINDS } from "./typing.ts"
import type { Reading } from "./validate.ts"
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
 * THE FILTER IS NOT HERE, and it is a decision rather than an oversight. A
 * `?q=` narrows what is drawn, and narrowing is a second question with a
 * reading of its own (`./narrowing.ts`, over the page this one produces) — one
 * that changes on every settled keystroke, where a page does not. Folded in,
 * every word typed would re-open this subscription and re-send every row of the
 * page it is already drawing (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-rides-the-page.md §4).
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
   *
   * `props` is the face's, and it rides here for the node's own reason: a page
   * ABOUT a document is where its record is read, and the body stream is the
   * prose. Empty when the file wrote none — an outline's nodes carry their own,
   * a `.html` is only shown, a `.md` without a `---` block has nothing to say
   * about itself.
   */
  Schema.Struct({
    kind: Schema.Literal("document"),
    file: Schema.String,
    /** Who points at this document — the "referred to by" list. */
    referrers: Schema.Array(Referrer),
    /** The named facts the file writes about itself — a `.md`'s frontmatter. */
    props: Custom,
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
  /** Every property value this page draws that NAMES something, and what it
   *  names — see the doors paragraph at the top of this module and
   *  {@link answersFor}. A value that names nothing is absent, which the drawing
   *  side reads as "the text it always was". */
  doors: Schema.Array(Door),
  /** ...and every property value this page draws that a RUNNING plugin's
   *  contributed kind CLAIMS, with the word it claims it under — the licence a
   *  live face is looked up by. Same walk, same dedupe, same discipline: an
   *  answer about one drawn value and never the declaration behind it. A value
   *  nothing claims is absent, which the drawing side reads as "this wears no
   *  face". */
  licences: Schema.Array(Licence),
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
 * Whether two requests are the SAME QUESTION — what keeps a subscription open
 * across a navigation that did not change which page is being drawn.
 *
 * Its caller is the browser (`@olai/web`'s `page.ts`), and what it is for is
 * one case: a link to a HEADING inside the document already on screen. That is
 * a place inside a page rather than a page, so it produces this same request —
 * and a subscription re-opened for it would blank the pane, unmount the body,
 * and take away the very element the reader was being scrolled to.
 *
 * Derived from the schema for `samePageReading`'s reason: an arm added to the
 * request is compared without anybody remembering to compare it.
 */
export const samePageRequest: (a: PageRequest, b: PageRequest) => boolean = Schema
  .toEquivalence(PageRequest)

/**
 * THE READING — what the address names, over the set as it stands.
 *
 * NAMED `pageOf` rather than `readingOf`, and the difference matters at the
 * call site: `readingOf` is already taken, twice, for "the set, read" (this
 * package's own testlib, and `@olai/ops`' fixtures). What this answers is a
 * PAGE.
 *
 * THE WHOLE READING, and not three of its parts. Two of the questions here are
 * about FILES rather than about records — which paths the directory serves at
 * all, and which of them is a day's note (`Query.homes`' argument one door
 * along, and the near miss it exists to avoid) — and a third is about what
 * points at a document, which is an index of its own (`./pointing.ts`). Those
 * are the three fields of a {@link Reading}, so the parameter is the reading:
 * a caller holds one, and four parameters were an invitation to hand over one
 * revision's set beside another's view, which is the very thing that value
 * exists to make unsayable.
 *
 * A `Document` IS a {@link Face} plus its content (`./document.ts` spreads the
 * face into every arm), so the set's own documents are read as they stand — no
 * projection per page per revision, and no second list to keep in step with the
 * one the directory was assembled from.
 */
export const pageOf = (
  at: Reading,
  request: PageRequest,
  kinds: KindVocabulary = NO_KINDS,
): PageReading => {
  const shows = shownOf(at, request)
  // THE DOORS FIRST, because the names table spends them: a value that turned
  // out to name a node is an id this page points at, and the chip drawing it
  // wants what that node is CALLED. Derived rather than asked for twice — a
  // second walk deciding which ids to resolve could disagree with the one that
  // decided which values are doors, and the disagreement would read as a ref
  // chip that fell back to its id for no reason a reader could see.
  const { doors, licences } = answersFor(at, shows, kinds)
  return {
    shows,
    names: namesFor(
      at.derived,
      shows,
      request.kind === "at" ? request.address : null,
      doors,
    ),
    doors,
    licences,
  }
}

/**
 * WHAT EVERY PROPERTY VALUE ON THIS PAGE NAMES, AND WHAT CLAIMS IT — the
 * projection, once per revision, on the page's own pulse.
 *
 * TWO TABLES OUT OF ONE WALK, and they are one walk on purpose rather than for
 * economy. The value's declaration decides both answers ({@link ./meaning.ts}'s
 * `consult`), so a second walk asking the second question is a second reading
 * of one rule — which is the bug family this whole seam was built to end, and
 * the licence was its most recent member. What the sharing costs is nothing:
 * the dedupe is per TRIPLE, so both tables are deduped by one `asked` set and a
 * value is consulted exactly once however many rows carry it.
 *
 * ONE WALK, and it is `drawnIn` — the same one the names table spends. That is
 * deliberately a SUPERSET of the records that draw chips (a zoom's crumbs and
 * its backlinks are drawn as links, not as runs of properties), and the trade
 * is named rather than hidden: the alternative is a second definition of "which
 * records of this page draw their facts", free to fall behind the first the
 * next time a page grows somewhere to put a node. What over-collecting costs is
 * a lookup per custom value of a handful of referenced records, and a wire entry
 * only for the ones that actually name something.
 *
 * THE DOCUMENT ARM IS ASKED SEPARATELY because its properties are not on a
 * record at all: a `.md`'s frontmatter is the file's own statement about itself
 * ({@link ./frontmatter.ts}), written in the document, so the file it was
 * written IN is the document. That is the same `from` its chips are drawn with
 * (`@olai/web`'s `document/DocumentPage.tsx`), which is what makes them find
 * their answers here.
 *
 * DEDUPED ON THE TRIPLE, for the names table's reason: a board where forty rows
 * carry `merge merge-auto` is one answer, and forty copies of it would be the
 * page paying per row for a fact that is per value.
 *
 * COSTS TWO SETS OF PATHS per page per revision — every served file, and the
 * `.md` half of it — which is the whole allocation this projection adds and is
 * the same order as the outline list {@link outlinesAmong} already builds
 * beside it, over the same array. The first is spent twice: as the "does the
 * directory serve this" question, and as the file list the declarations
 * convention is found in, which is what lets the declarations be read off ONE
 * file's records rather than off a walk of every file's.
 */
const answersFor = (
  at: Reading,
  shows: Shown,
  kinds: KindVocabulary,
): { readonly doors: ReadonlyArray<Door>; readonly licences: ReadonlyArray<Licence> } => {
  const served = new Set<string>(at.set.documents.map((face) => face.path))
  // ...AND THE `.md` HALF OF IT, which is a second set and has to be: a `doc`
  // value promises to name a served DOCUMENT, and the gate holds it to exactly
  // this list ({@link ./typing.ts}'s `Typed.documents`). Built by the same
  // function the validator builds its own with rather than by filtering the
  // paths above, which would be a second answer to "which of these is a
  // document" — the very shape this module exists to have one of.
  const documents = markdownPaths(at.set)
  const vault: Vault = {
    // THE DECLARATIONS FILE FOUND IN THE SET, and not by walking the
    // derivation's own file list — which is the one line of this projection
    // that is about the tape rather than about doors. A walk of `byFile` is
    // taped as a dependency on the whole index, so every open page would
    // rebuild for a keystroke anywhere in the vault; the SET's paths are
    // compared face by face, so a record edit does not move them
    // ({@link ./tape.ts}). What this page then depends on is the declarations
    // file's own records, which is exactly what its answers depend on.
    declarations: declarationsIn(at.derived, propertiesIn(served)),
    // ...AND WHAT THE WORDS IN IT MEAN, which is the one fact in this value
    // that is not a reading of the set at all: which kinds a plugin taught
    // this vault is the composition root's to say, and it is handed the whole
    // way down rather than reached for ({@link ./typing.ts}'s
    // `KindVocabulary`). The GATE reads the same value, so a contributed kind
    // has one entry and not two opinions.
    kinds,
    // `nodeNamed` and not the index, for {@link namesFor}'s reason: an id may
    // address a MIRROR, and what a reader can be shown is the node standing at
    // that placement.
    declares: (id) => nodeNamed(at.derived, id) !== undefined,
    serves: (file) => served.has(file),
    documents: (file) => documents.has(file),
  }
  const doors: Array<Door> = []
  const licences: Array<Licence> = []
  const asked = new Set<string>()
  const ask = (from: string, custom: Custom): void => {
    for (const [key, held] of Object.entries(custom)) {
      for (const value of typeof held === "string" ? [held] : held) {
        // The triple, joined on a character no path, key or value can hold —
        // a value is somebody's prose and may carry any separator a reader
        // would think of. The wire carries the three fields APART, so this
        // spelling is this walk's own and the browser is free to key its
        // lookup however it likes.
        const triple = `${from}\u0000${key}\u0000${value}`
        if (asked.has(triple)) continue
        asked.add(triple)
        // ONE CONSULT, both answers. They are never both present — a claimed
        // value opens nothing, which `meaning.ts`'s `contributed` arm argues —
        // so this reads as two independent pushes rather than as a branch.
        const { opens, word } = consult(vault, from, key, value)
        if (opens !== null) doors.push({ from, prop: key, value, opens })
        if (word !== null) licences.push({ from, prop: key, value, word })
      }
    }
  }
  for (const node of drawnIn(shows)) ask(node.file, customOf(node.node))
  if (shows.kind === "document") ask(shows.file, shows.props)
  return { doors, licences }
}

/** The OUTLINES' paths, in path order — what the trash reads and what the front
 *  page picks its first file from. A narrowing of the one list rather than a
 *  list beside it: asking says which files are being left out. */
const outlinesAmong = (faces: ReadonlyArray<Face>): ReadonlyArray<string> =>
  faces.filter((face) => fileKind(face.path) === "outline").map((face) => face.path)

/** WHAT THE ADDRESS PUTS ON THE SCREEN, without the names table beside it —
 *  {@link pageOf} minus its second half. Exported for the one caller that wants
 *  the rows and nothing else: the page's NARROWING (`./narrowing.ts`), which
 *  matches over the records this page draws and resolves no id at all. */
export const shownOf = (at: Reading, request: PageRequest): Shown => {
  const { derived } = at
  const faces = at.set.documents
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
  // element with no document; a heading is in a BODY by construction; a ROW
  // names its outline by its path and falls through to the last arm, because
  // where it lands is that arm's caller's: the page is the file's and the
  // fragment is a place inside it; and a path with no element is whatever its
  // suffix says — an outline is a tree of
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
    const face = faces.find((one) => one.path === file)
    if (face === undefined) {
      // The kind the reader ASKED FOR, off the name the address spelled — so
      // "no such document" and "no such saved page" send them to two different
      // places. `?? "document"` is unreachable (a suffix the registry claims is
      // what makes a path an address at all) and is kept honest rather than
      // asserted away.
      return { kind: "nothing", sought: bodyKind(file) ?? "document", requested: file }
    }
    return {
      kind: "document",
      file,
      referrers: referrersTo(address, at.pointing, derived),
      // TOTAL, like the face: empty is the honest none, not an omitted field.
      props: face.props,
    }
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
  const unreadable = at.set.broken.find((one) => one.file === file)
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
 * Three kinds of pointer, and every one is read off the records the reading
 * already carries rather than off the vault: the EDGE fields a node writes
 * (`see`, `after`), which a row draws as a strip of links; an ADDRESS somebody
 * wrote INTO a title, which is the same reading the shelf is built out of
 * (`./shelf.ts`'s `pinTargetIn`) and the last address resolution the browser
 * was still doing locally; and a CUSTOM VALUE that turns out to be an id.
 *
 * ## The custom half, which is a CANDIDATE rather than a pointer
 *
 * The first two are declarations: a `see` names a node, and the format says so.
 * A `custom` value declares nothing — nothing in olai reads a key in there
 * (`./custom.ts`) — so `{"reviewer":"pi"}` is a string that MIGHT be the id of
 * a node in this set and might be somebody's name. Resolving it is exactly what
 * settles that: an id the set declares comes back named, and one it does not is
 * simply absent, which is the same honest answer this table already gives for a
 * dangling `see`. The drawer that spends it draws a door for the first and
 * plain text for the second (`@olai/web`'s `props/door.ts`) — a wrong door
 * being worse than no door is the whole reason the question is asked HERE,
 * where the set is, rather than guessed at in a browser that no longer holds
 * one.
 *
 * ONLY A VALUE SHAPED LIKE AN ID is asked about ({@link ID_SHAPE}), which is
 * what keeps this from being a lookup per word of somebody's prose: a `merge`
 * holding a sentence has spaces in it and never reaches the index, and a
 * `verdict` holding a paragraph is one string tested against one regex. A LIST
 * value contributes each of its members for the same reason a `see` does —
 * `{"reviewer":["pi","grok"]}` is two facts, and drawing one of them as a door
 * and the other as text would be the display inventing a difference the record
 * does not have.
 *
 * The REQUESTED address joins them, and it is the one entry that is not about a
 * row: the palette's pin row names the page it is standing on, and a `/#id`
 * page is called whatever that node is called right now. Nothing here answers
 * for the ROW arm, and that is by rule rather than by omission: the one client
 * who asks never builds a request with a row in it — `@olai/web`'s
 * `requestFor` turns it into the document, because the row is a landing and
 * two links to one outline are one question — and its palette names the row
 * page by its file, which is the heading arm's own answer
 * (`@olai/web`'s `address/address.ts`).
 */
const namesFor = (
  derived: Derived,
  shows: Shown,
  address: Address | null,
  doors: ReadonlyArray<Door>,
): ReadonlyArray<Named> => {
  const wanted = new Set<string>()
  if (address?.kind === "node") wanted.add(address.id)
  // EVERY DOOR ONTO A NODE, whatever the value looked like. The `ID_SHAPE`
  // filter below is a cheap test over prose nobody declared, and it is the
  // right test there; a value the consult RESOLVED is a node this page points
  // at by the strongest warrant there is, so it is named here rather than left
  // to a shape rule that was never about it. A ref chip drawing its target's
  // title is exactly this join ({@link ./meaning.ts}'s `titled`).
  for (const door of doors) if (door.opens.kind === "node") wanted.add(door.opens.id)
  for (const node of drawnIn(shows)) {
    for (const id of node.node.see ?? []) wanted.add(id)
    for (const id of node.node.after ?? []) wanted.add(id)
    const written = pinTargetIn(node.node.title)
    if (written !== undefined) wanted.add(written)
    for (const value of Object.values(customOf(node.node))) {
      for (const one of typeof value === "string" ? [value] : value) {
        if (ID_SHAPE.test(one)) wanted.add(one)
      }
    }
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

/**
 * EVERY PLACE ON THIS PAGE A NARROWING CAN TAKE AWAY — the ROWS, and nothing
 * else the reading carries.
 *
 * Defined by what the PRUNE tests rather than by what a page holds:
 * `keeping`, `keepingDated` and `keepingOwed` each ask about the node a row
 * SHOWS, and nothing else on a page is a row. So a zoom's heading and crumbs,
 * its backlinks, a document's referrers and the blockers under a mark are all
 * out — a filter has never taken one away, and a match found only there would
 * be an id nothing looks up.
 *
 * HERE rather than beside the reading that consumes it (`./narrowing.ts`),
 * because "what is a ROW of this page" is a fact about the page: two answers to
 * it would be a filter and a names table free to disagree about the same
 * reading, and a page kind that grew a place to draw a node would have to be
 * told twice. {@link drawnIn} is this walk PLUS the references, which is the
 * other half of the same table.
 *
 * `shows` and not the row's own record: a row that shows nothing — a mirror
 * whose chain died, one that closed a loop — draws a PLACEMENT, and there is
 * nothing in a placement for a query to select. `keeping` keeps such a row when
 * something under it matched, which is the same answer this absence gives.
 */
export function* narrowableIn(shows: Shown): Generator<LocatedRegular> {
  switch (shows.kind) {
    case "outline":
      yield* inRows(shows.rows)
      return
    case "node":
      if (shows.zoomed.kind === "node") yield* inRows(shows.zoomed.children)
      return
    case "day":
      yield* inGroups(shows.groups)
      return
    case "agenda":
      // The line, in the order it is drawn — two runs of DAYS around the groups
      // today holds, which is the shape `agendaOf` produced and `keepingOwed`
      // prunes.
      yield* inDays(shows.agenda.overdue)
      yield* inGroups(shows.agenda.today)
      yield* inDays(shows.agenda.upcoming)
      return
    case "trash":
      for (const group of shows.groups) yield* inRows(group.rows)
      return
    case "document":
    case "broken":
    case "nothing":
      return
  }
}

/** Every regular record this reading MENTIONS, however deep — the rows above
 *  plus everything the page POINTS AT, which is what the names table spends.
 *  One walk over the arms, so a page that grows a place to draw a node grows a
 *  place to resolve what that node points at, in one edit rather than two. */
function* drawnIn(shows: Shown): Generator<LocatedRegular> {
  yield* narrowableIn(shows)
  yield* referencedIn(shows)
}

/**
 * ...and the other half: what this page points AT rather than draws as a row.
 *
 * A zoom's own heading and its crumbs, the backlinks under it, a document's
 * referrers, and what any place is WAITING ON — every one of them is drawn as a
 * link, so what its title addresses is a name this page spends, and none of
 * them is a row a filter takes away.
 */
function* referencedIn(shows: Shown): Generator<LocatedRegular> {
  switch (shows.kind) {
    case "outline":
      yield* waitedOnIn(shows.rows)
      return
    case "node":
      if (shows.zoomed.kind === "node") {
        yield shows.zoomed.shows
        yield* shows.zoomed.trail
        yield* inWay(shows.zoomed.blocked)
        yield* waitedOnIn(shows.zoomed.children)
      }
      for (const backlink of shows.backlinks) yield backlink.at
      return
    case "document":
      for (const referrer of shows.referrers) {
        if (referrer.at !== undefined) yield referrer.at
      }
      return
    case "day":
      yield* situatedIn(shows.groups)
      return
    case "agenda":
      for (const day of shows.agenda.overdue) yield* situatedIn(day.groups)
      yield* situatedIn(shows.agenda.today)
      for (const day of shows.agenda.upcoming) yield* situatedIn(day.groups)
      return
    case "trash":
      for (const group of shows.groups) yield* waitedOnIn(group.rows)
      return
    case "broken":
    case "nothing":
      return
  }
}

function* inRows(rows: ReadonlyArray<Row>): Generator<LocatedRegular> {
  for (const row of rows) {
    if (row.kind === "node" || row.kind === "mirror") yield row.shows
    yield* inRows(row.children)
  }
}

/** What the rows of a tree are WAITING ON, however deep — the reference half of
 *  {@link inRows}, walked separately so the row half is one definition both
 *  readings stand on. */
function* waitedOnIn(rows: ReadonlyArray<Row>): Generator<LocatedRegular> {
  for (const row of rows) {
    yield* inWay(row.blocked)
    yield* waitedOnIn(row.children)
  }
}

function* inGroups(groups: ReadonlyArray<DayGroup>): Generator<LocatedRegular> {
  for (const group of groups) for (const entry of group.nodes) yield entry.shows
}

/** {@link inGroups} over a run of DAYS — the two halves of the agenda's line
 *  that arrive as days, said once because both ask it. */
function* inDays(days: ReadonlyArray<AgendaDay>): Generator<LocatedRegular> {
  for (const day of days) yield* inGroups(day.groups)
}

/** Where each of a day's rows SITS, and what is standing in its way — the
 *  reference half of {@link inGroups}, for {@link waitedOnIn}'s reason. */
function* situatedIn(groups: ReadonlyArray<DayGroup>): Generator<LocatedRegular> {
  for (const group of groups) {
    for (const entry of group.nodes) {
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
