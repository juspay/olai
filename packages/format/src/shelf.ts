/**
 * THE SHELF, READ OFF THE SET — the rows of `Pins.olai` and what the directory
 * says each one points at.
 *
 * The shelf is a reading of the whole vault: which file the shelf IS is a fact
 * about the directory (`./node.ts`'s `pinsIn`), the rows are that file's top
 * level, and what a bare pin is CALLED is the live title of whatever node its
 * address names — a node that may sit in any other file. The browser used to
 * do all three over its own copy of every outline; that copy is what
 * `docs/brainstorming/vault-in-browser.md` is taking away, so the reading is
 * here — isomorphic, called on the server, published to the tab that draws it
 * (§6's item 5).
 *
 * ## What crosses, and the one thing that deliberately does not
 *
 * A row travels as the FILE's own two facts — the pin node's id and its title,
 * verbatim — plus the one fact only the SET can answer: the node that title
 * addresses, and what it is called right now ({@link Pinned.shows}).
 *
 * What is NOT decided here is which page an address opens. That is ruled, and
 * the ruling is docs/format.md's own seam: *what an ADDRESS is* — `[document]
 * #[element]` — is this package's, because it is a statement about the
 * directory; *which page one opens, and what a `?q=` on it means*, is the
 * browser's, at view time, through the same bijection that wrote it
 * (`@olai/web`'s `routes.ts`). So the server does not sort a title into "a day,
 * the agenda, a document"; it reads the one thing the grammar down here can
 * read on its own — {@link pinTargetIn}, the NODE an address names — and hands
 * the title over otherwise untouched. The tab parses it with the parser that
 * printed it, which is a parse of one string and not a scan of a vault
 * (`@olai/web`'s `filter/asking.ts` argues the same line for the search
 * grammar).
 *
 * That split is what keeps one answer per question. The names a browser
 * derives — `finishes.md`, *Agenda*, *Today*, the date on a day page — are
 * pure over the address itself and were never a reading of the set; the name
 * this file answers is the only one that was.
 */

import { Schema } from "effect"

import { addressWritten, parseAddress, splitAddress } from "./address.ts"
import { type Derived, nodeNamed, rootsOf } from "./derive.ts"
import { pinsIn } from "./node.ts"

/**
 * One row of the shelf, as the wire carries it.
 *
 * THE TITLE TRAVELS VERBATIM, which is what makes this an answer about the
 * FILE rather than a rendering instruction: `Pins.olai` is an ordinary outline
 * a hand and an agent are invited to edit, so what a row says is what somebody
 * wrote, and the reader that draws it is the one that reads addresses.
 */
const Pinned = Schema.Struct({
  /** The pin NODE's own id — what an unpin trashes and what a reorder moves.
   *  Never the id of whatever the address names. */
  id: Schema.String,
  /** The row's title exactly as the file holds it: a bare address, a markdown
   *  link around one, or something that is neither (a heading somebody wrote
   *  in their own shelf file — see {@link shelfOf}). */
  title: Schema.String,
  /**
   * The node this row's address names, and what it is called RIGHT NOW —
   * absent when the title addresses no node, and absent when it addresses one
   * the set does not declare.
   *
   * ABSENCE IS THE ANSWER for both, as it is for the transcript's id lookup
   * (`./reading.ts`'s `NamedAnswer`), and the reader can tell them apart
   * because it has the title: an address that names no node is drawn by its own
   * spelling, and a NODE address with nothing to show is the honest dead row
   * docs/format.md promises (`/#gone`, drawn as itself).
   *
   * It is the whole reason this member is re-answered per revision: rename that
   * node anywhere, by anyone, and the shelf says the new name on the frame the
   * store publishes — because there was never a second copy of it to go stale.
   *
   * THE ID TRAVELS BESIDE THE NAME, and that is what makes this answer safe to
   * hand a reader that reads the same title with a parser of its own — which is
   * exactly what the browser does, and NOT with the same answers. This reading
   * over-answers by construction: the app claims words of its own before the
   * grammar is asked at all (`/d/…`, `/today`), so `/d/2026-08-20.olai#x` is a
   * day page up there and an outline's node down here. What holds is one
   * direction — wherever the app reads a node, this reads the same node
   * (`@olai/web`'s `pins/target.test.ts`) — and the id is what lets the drawing
   * side spend a name only where it agrees the row addresses that node. A name
   * for some OTHER place is the one wrong thing a door can say; this makes it
   * unsayable for one comparison. It is the echo `NamedAnswer`'s rows carry,
   * for the same reason.
   */
  shows: Schema.optionalKey(Schema.Struct({
    /** The id the row's address names, in the spelling the grammar normalises
     *  to — never the id of the node a MIRROR chain ends at, which is what
     *  {@link Pinned.shows.name} is about. */
    id: Schema.String,
    /** That node's title, as of this revision. */
    name: Schema.String,
  })),
})
export type Pinned = typeof Pinned.Type

/** The shelf in the order it is drawn — the top level of the directory's
 *  `Pins.olai`, in `ord` order. */
export const Shelf = Schema.Array(Pinned)
export type Shelf = typeof Shelf.Type

/** A directory with no shelf, one whose shelf holds nothing, and a server that
 *  has never loaded — one value, because all three draw nothing. */
export const NO_PINS: Shelf = []

/**
 * Whether two answers say the same thing — what keeps a revision that moved no
 * pin from sending a frame to every open tab.
 *
 * About what is SAID rather than about identity: the reading mints a fresh
 * array per revision, so `===` would never hold and every write anywhere in the
 * vault would redraw every sidebar.
 *
 * DERIVED from the schema, for `./committing.ts`'s reason word for word: a
 * hand-written comparison is the declaration of those fields spelled a second
 * time, and the next field added to a row would simply not be compared. The
 * failure mode is a frame that is never sent — a shelf holding a name the
 * directory has moved past, with nothing anywhere raising an error, which is
 * the thing an `equals` is here to prevent.
 */
export const sameShelf: (a: Shelf, b: Shelf) => boolean = Schema.toEquivalence(Shelf)

/**
 * THE NODE A PIN TITLE ADDRESSES, or `undefined` — the one question about a
 * pin's address that is answered down here.
 *
 * WHICH addresses name one is `./address.ts`'s answer and not this function's:
 * the bare `#id` and the qualified `garden.olai#id` both do, and the second
 * normalises to the same id, which is exactly why this asks the grammar rather
 * than matching a shape. What is done here is the two things the app writes
 * around an address in a title, both of which docs/format.md's Pins spells: the
 * leading slash is skipped, and the `?q=` is taken out — it sits between the two
 * halves of a URL, so cutting the fragment first leaves the path to cut at the
 * `?`. Neither is interpreted; what a query MEANS is the browser's.
 *
 * EVERY OTHER ADDRESS ANSWERS `undefined`, and none of them is a mistake: a
 * document, a heading, a day and the pages that spell a word all name
 * themselves, and what they are CALLED is derived from the address rather than
 * from the set. So this is not "is that a pin" — it is "is there a node here
 * whose title only the set knows".
 *
 * WHICH IS WHY IT HAS A SECOND CALLER, and the name is the shelf's only
 * because the shelf asked first: `./page.ts` reads it over every title a PAGE
 * draws, so a row of any outline whose title is an address is named by the same
 * rule the sidebar's shelf is (`@olai/web`'s `NodeTitle.tsx` draws one face for
 * both). One question, one function, two readings.
 *
 * TOTAL over any string, because {@link parseAddress} is: a title spelled with
 * an escape nothing can read names nothing, rather than throwing on the server
 * that is answering every open tab.
 *
 * IT ANSWERS ABOUT MORE TITLES THAN THE BROWSER DOES, and knowingly: the app's
 * URL space claims words this grammar cannot see (`/d/…`, `/today`), so a title
 * spelling one of those with a document and a fragment in it is a page up there
 * and a node down here. What is pinned is the direction that matters — wherever
 * the app's own parser reads a node, this reads the same node (`@olai/web`'s
 * `pins/target.test.ts`, the oracle rule this design keeps wherever one reading
 * is answered on two sides) — and {@link Pinned.shows} carries the id so the
 * extra answers cost a reader nothing.
 */
export const pinTargetIn = (title: string): string | undefined => {
  const at = addressWritten(title)
  if (!at.startsWith("/")) return undefined
  // Cut the way this app writes a URL ({@link splitAddress}, the one spelling
  // of that cut and the same one the browser's parser reads a title with), then
  // hand the two halves of what is left to the grammar — which is what decides
  // whether this names a node.
  const { pathname, fragment } = splitAddress(at.slice(1))
  const address = parseAddress(pathname + (fragment === undefined ? "" : `#${fragment}`))
  return address?.kind === "node" ? address.id : undefined
}

/**
 * THE SHELF: the top level of the directory's `Pins.olai`, in the order it is
 * drawn, with every node address resolved to the name it has right now.
 *
 * THE TOP LEVEL ONLY, and that is a rule rather than a shortcut: a shelf is a
 * flat row of doors, so what is nested under a pin is that pin's own business
 * (notes about it, a checklist) and not a second row in the sidebar.
 *
 * A MIRROR IS NOT A PIN and is left out here, because a placement carries no
 * title at all — there is nothing to address with. Every other row travels,
 * including one whose title is not an address: whether a title names a PAGE is
 * the app parser's answer (docs/format.md says so out loud, so that the test is
 * a parser rather than a list of prefixes), and a row this could not draw is a
 * row `Pins.olai`'s own page still draws as an ordinary heading or note.
 */
export const shelfOf = (derived: Derived): Shelf =>
  shelfIn(derived, pinsIn(derived.byFile.keys()))

/**
 * The shelf of a NAMED file — {@link shelfOf} with the convention walk lifted
 * out of it, for the caller that carries that answer across revisions rather
 * than re-deriving it per one (`./conventions.ts`, `perf-filename-conventions`).
 *
 * TWO FUNCTIONS AND NOT A DEFAULTED ARGUMENT, because `undefined` is an answer
 * here and not an absence of one: a directory with no shelf file draws nothing,
 * and a caller passing `undefined` is saying that rather than declining to
 * say anything. The one above stays the plain reading — what the shelf IS, over
 * a view and nothing else — and it is what the differential holds the carried
 * answer against (`./conventions.test.ts`), the way #387 kept its rebuild in
 * the module the sharing lives in.
 */
export const shelfIn = (derived: Derived, file: string | undefined): Shelf => {
  if (file === undefined) return NO_PINS
  return rootsOf(derived, file).flatMap((located) => {
    const node = located.node
    const row = { id: node.id, title: node.title }
    const target = pinTargetIn(node.title)
    if (target === undefined) return [row]
    // `nodeNamed` and not the index: an id may address a MIRROR, and what a
    // reader can be shown is the node standing at that placement — the same
    // lookup a `see` link's text and an edge target already are.
    const shows = nodeNamed(derived, target)
    return [shows === undefined ? row : { ...row, shows: { id: target, name: shows.node.title } }]
  })
}
