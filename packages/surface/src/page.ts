/**
 * WHAT ONE PAGE SHOWS, as the wire speaks it — the member this whole design was
 * for.
 *
 * `docs/brainstorming/vault-in-browser.md`'s §2 in one sentence: the contract
 * goes from "the whole set, plus every delta" to "what this page shows, plus
 * updates to that". A tab subscribes to the address it is drawing; the server
 * computes the reading and re-sends it whenever a revision changes it. The
 * outlines collection stops being something a browser reads at all.
 *
 * ## Why the shapes are `@olai/format`'s, re-exported and not re-declared
 *
 * `./search.ts`'s argument and `./dates.ts`'s, word for word: one vocabulary on
 * the floor that this spec and the ops layer both stand on, so there is no
 * second spelling to drift. It matters more here than anywhere, because what
 * travels is the ROWS — the same `Row`, `Zoomed`, `DayGroup` and `Agenda` the
 * format's own walks produce and the browser's components already draw. A
 * second declaration of those in this package would be a wire shape free to
 * stop meaning what a page means, and the failure would look exactly like the
 * search case it is written against: type-checks clean everywhere, one field
 * silently dropped by the encoder.
 *
 * ## Why it is a STREAM and not a procedure
 *
 * A stream is a cell with an argument — read, listen, re-read on every
 * published revision, emit only when the answer moved — and both halves of that
 * are what a page needs. The ARGUMENT is the address, which a cell cannot have.
 * The STANDING part is the whole promise of this app: an edit from an agent, a
 * `git pull`, a keystroke in another tab all reach the page somebody is looking
 * at with no reload and no poll. Asked as a procedure it would need a
 * generation to re-ask on, and the only generation a browser had was its own
 * copy of the derivation — the copy this design takes away.
 *
 * ## What deliberately does NOT ride here
 *
 * THE BODY of a document. The `/doc/` reading says which file and who refers to
 * it; the text arrives on the `documents` collection's per-key `get`, read by
 * whoever opened one. That member is the shape this design generalises, and
 * folding a body into a page reading would un-generalise it.
 *
 * THE NARROWING. A `?q=` is a second question with its own door
 * (`search.matching`), asked of the whole set, debounced and stale-guarded. A
 * page reading that took the query would be that door built twice, re-asked on
 * every keystroke, with the page's rows in every answer.
 *
 * THE READER'S OWN HIDING. Done-visibility is a preference of this browser, so
 * the rows arrive whole and the switch prunes them locally — which is also why
 * a row carries `under`, the count of what an archive would take in the SET
 * rather than what survived the prune.
 *
 * ## And why the move picker is a second stream beside it
 *
 * {@link moving} is the one question in the app that is about the vault and not
 * about any page: the destinations it judges are whatever the search just
 * answered with, which are nodes the open page does not draw. It has a page's
 * two properties — an argument, and standing, since a panel left open while an
 * agent writes must judge against where the row has actually got to — so it is
 * the same kind of member rather than a procedure the panel would have to know
 * when to re-ask.
 */

/**
 * THE SHAPES, and not the equivalences beside them — `./dates.ts`'s rule: a
 * stream does not declare an `equals` at all, the server supplies `isEqual`
 * where it binds the member, from the same floor. A name crossing this boundary
 * for nobody is a public API with no caller.
 */
export {
  /** What the address turned out to name, what it put on the screen, and what
   *  the ids it points at are called. */
  PageReading,
  /** Which page — the browser's route with the clock already read. */
  PageRequest,
} from "@olai/format"

export {
  /** The row being moved and a verdict per destination, in the order asked. */
  MovingAnswer,
  /** Which row, and which destinations to judge. */
  MovingRequest,
} from "@olai/format"
