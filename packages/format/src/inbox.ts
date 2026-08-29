/**
 * THE INBOX CONVENTION, read both ways: what a capture BECOMES, and how full
 * the file is afterwards.
 *
 * Which outline the inbox IS is `./node.ts`'s ({@link inboxIn}) — a statement
 * about what a served file is by its name, beside `TRASH`. This module is the
 * two things a reader of that convention asks next, and they are here together
 * because they are one fact read from two sides: a directory with no inbox is
 * a `create` for the capture and a `0` for the door, and the two must never
 * disagree about which file they meant.
 *
 * ## What a capture becomes ({@link captureInto})
 *
 * One write request — and the row it writes is BORN MARKED `todo`, minted
 * there rather than asked of whichever door composed the line, because the
 * law below is what makes a capture findable: a capture that landed unmarked
 * would be invisible to the badge the moment it landed. Marked = awaits you;
 * unmarked = furniture.
 *
 * ## How full the inbox is ({@link inboxHeldOf}) — the number the door wears.
 *
 * THE LAW, one sentence: the badge counts the rows in the inbox marked
 * `todo` or `doing` — any depth, full stop. There is no top-level clause, no
 * leaf/header distinction and no walk: a mark is a row asking to be looked
 * at, an unmarked row is furniture, and a `done` or `cancelled` row has been
 * looked at. A placement is not a node, so a mirror never counts — the count
 * excludes them without a clause of its own. Empty, missing, unreadable,
 * only placements, nothing marked: zero.
 *
 * This replaced (ruled, human 2026-08-29) a top-level walk — the #348/#351
 * "root that still awaits processing" filter and its cycle guard, which
 * decided by branch what the file owed. Its failure was the failure of every
 * walk that second-guesses the marks: an emptied section header ("Awaiting
 * the human's word", a childless bare bullet) wore a badge of 1 over a page
 * showing nothing open. Under the one sentence it wears 0, with no special
 * clause. The accepted cost: an EXISTING bare-bullet capture stops counting —
 * furniture now, until somebody marks it.
 *
 * A READING of the set, the way `./shelf.ts` is: the browser may not hold the
 * vault, so the server answers this per published revision and the sidebar
 * draws the number (`@olai/surface`'s `inbox` cell). What it is NOT is a
 * second walk of the rows the inbox PAGE draws — those arrive on `page` —
 * because the door has to say how full the file is while somebody is
 * somewhere else.
 */

import { Schema } from "effect"

import { type Derived, nodesOf, unfinishedWork } from "./derive.ts"
import { INBOX, inboxIn, isRegular, mintedInto } from "./node.ts"
import { type OutlineSet, outlinePaths } from "./set.ts"
import { type OpFailure, UsageFailure } from "./failure.ts"
import type { Capture, WriteRequest } from "./writing.ts"

/**
 * How many rows the inbox still owes a look at, as the wire carries it.
 *
 * ONE INTEGER, and nothing else: which file that is is a fact about the
 * PATHS (`inboxIn` over the directory's names), and the door already reads
 * those. Duplicating the path here would be two answers to "which outline
 * is the inbox".
 */
export const InboxHeld = Schema.Struct({
  /** Regular nodes of the directory's inbox marked `todo` or `doing`, at
   *  any depth — the whole law. A `done` or `cancelled` row does not count,
   *  an unmarked row is furniture, and a placement is not a node. Zero when
   *  there is none, when the file holds nothing, when it would not parse,
   *  and when nothing in it is marked. */
  count: Schema.Int,
})
export type InboxHeld = typeof InboxHeld.Type

/** No inbox, an empty one, a torn one, a placements-only one, one holding
 *  nothing but unmarked rows, one whose every mark has settled, and a server
 *  that has never loaded — one value, because all seven wear no chip. */
export const NO_INBOX: InboxHeld = { count: 0 }

/**
 * Whether two answers say the same thing — what keeps a revision that moved
 * no capture from sending a frame to every open tab.
 *
 * DERIVED from the schema, for `./shelf.ts`'s reason: a hand-written
 * comparison is the declaration spelled a second time.
 */
export const sameInboxHeld: (a: InboxHeld, b: InboxHeld) => boolean =
  Schema.toEquivalence(InboxHeld)

/**
 * How full the directory's inbox is, read off the set.
 *
 * THE FILE is found the way the capture is (`inboxIn` over
 * {@link outlinePaths}), not over `derived.byFile`. `byFile` is a grouping of
 * parsed records: an empty outline and a torn one have no entry, so a
 * shallowest empty `Inbox.olai` beside a populated `_olai/Inbox.olai` would
 * send the door and every future capture to the empty file and the count to
 * the deeper one. The set's paths are the list capture already walks.
 *
 * THE NUMBER is the one law over that file (`./inbox.ts`'s header): the
 * regular records carrying an unfinished mark, at any depth. There is no
 * walk to prune and nothing to count twice — a record answers for itself
 * and its line says what it is.
 */
export const inboxHeldOf = (set: OutlineSet, derived: Derived): InboxHeld =>
  inboxHeldIn(derived, inboxIn(outlinePaths(set)))

/**
 * How full a NAMED file is — {@link inboxHeldOf} with the convention walk
 * lifted out of it, for the caller that carries which file the inbox is across
 * revisions instead of re-deriving it per one (`./conventions.ts`,
 * `perf-filename-conventions`). The shelf's twin one file over
 * (`./shelf.ts`'s `shelfIn`), and it takes a `Derived` alone for the same
 * reason that one does: with the file already named there is nothing left here
 * the SET can answer.
 *
 * `undefined` is the answer "this directory has no inbox", which is `0` —
 * the same value an empty, a torn and an all-done one wear ({@link NO_INBOX}).
 */
export const inboxHeldIn = (
  derived: Derived,
  file: string | undefined,
): InboxHeld => {
  if (file === undefined) return NO_INBOX
  // `unfinishedWork` is the format's own spelling of "marked todo or doing":
  // one composition (`./derive.ts`), asked of every record the file holds.
  // `isRegular` first, so a placement is never asked the question — a mirror
  // stands in the inbox but it is not a row somebody owes a look at.
  const count = nodesOf(derived, file).filter(
    (located) => isRegular(located) && unfinishedWork(located.node),
  ).length
  return { count }
}

/**
 * A capture as one of OLAI'S OWN DOORS composes it: {@link Capture} without the
 * one field that exists only to be refused.
 *
 * `after` is declared on a capture so that an agent writing the edge list under
 * the name `set_after` gives it is turned away BY NAME rather than having its
 * dependency silently dropped ({@link ./writing.ts}) — and at the TOP of an
 * `add` that same word means the sibling anchor, which is a string. So the two
 * spellings genuinely collide, and a door of ours spreading a whole capture
 * into an `add` is where the collision shows up. It is not a problem to solve:
 * nothing composing a capture writes the bent word, so the type says so.
 */
export type Capturing = Omit<Capture, "after">

/**
 * THE ONE OP A CAPTURE IS — an `add` into the inbox the directory has, or the
 * `create` that mints one holding exactly this capture.
 *
 * THREE DOORS capture into this directory and none of them names a file: the
 * palette's `⌘K` `+` sends a line, the `capture` TOOL sends one from an agent
 * or from `olai surface capture`, and an agent that would rather aim reads the
 * outlines and calls `add_node` or `create_outline` itself (which is why
 * `list_outlines` says the convention in words — the one door that is handed
 * the rule rather than the function). The first two resolve through THIS, and
 * that is the whole reason
 * it is here rather than in whichever face happened to need it first: it is a
 * statement about the DIRECTORY, the same kind of thing {@link inboxIn} above
 * it is, and a second spelling of "is there an inbox yet, and what do I do
 * about it" is two answers about one directory.
 *
 * It came down from `@olai/server` the day it got its second caller, which is
 * the move `./message.ts` records for itself in the same words.
 *
 * THE TWO ARMS ARE NOT INTERCHANGEABLE, which is why the choice is made here
 * and not by a caller off a file list it happens to hold: `create` is refused
 * for a file that exists and `add` is refused for one that does not. Either
 * way it is ONE request, so one plan, one validation and one atomic rename —
 * a capture that is refused leaves nothing behind, not a half-filled inbox and
 * not an empty file.
 *
 * WHERE ONE IS MINTED is `_olai/Inbox.olai` and not the root ({@link
 * mintedInto}, human 2026-08-20, reversing the ruling of the day before): the
 * shelf's argument read one convention over — a file olai made because
 * somebody pressed something is not one of the reader's own. The READING is
 * untouched, so a directory that already keeps an `Inbox.olai` at its root, or
 * a `notes/inbox.olai`, goes on capturing into the file it has and nothing
 * migrates.
 *
 * NOTHING IS VALIDATED HERE. A blank title, a date that is not a date, a
 * property spelled like a field this format already has — each is refused by
 * the write planner in its own words, which is the same sentence an agent's
 * `add_node` gets. A second rule here would be a door refusing something in
 * words no tool uses.
 *
 * PURE, over the directory's OUTLINE PATHS — not over a whole `Reading`,
 * because the paths are all it reads and they are what every caller can get
 * cheaply. A face holding a `Reading` passes `outlinePaths(at.set)`; a face holding
 * only the LISTING (`ops.outlines` over a wire, which is what `capture` in
 * `@olai/ops`' table has) passes the paths off that, and neither has to
 * re-derive the inbox rule to do it. Widening it back to a `Reading` would put
 * this function out of reach of the one face that has no store.
 */
export const captureInto = (
  paths: ReadonlyArray<string>,
  capture: Capturing,
): WriteRequest => {
  // THE MARK IS MINTED HERE, once, for every door and both arms (ruled,
  // human 2026-08-29): a capture is born `todo`, because `inboxHeldOf`'s one
  // law counts the marked rows and an unmarked capture would land invisible
  // to it. No door can spell a mark of its own — a {@link CaptureRequest} is
  // a title and a note, and the palette sends a title — so this is not an
  // override of anything anybody said.
  const minted = { ...capture, mark: "todo" as const }
  const inbox = inboxIn(paths)
  return inbox === undefined
    ? { op: "create", file: mintedInto(INBOX), seed: minted }
    : { op: "add", file: inbox, ...minted }
}

// ── what a capture IS, at whichever door takes one ──────────────────────

/** The property the identity is recorded as. A key rather than a field,
 *  because the format gives it no meaning and olai reads nothing in it — it is
 *  there for the person who captured, and for `prop:captured-by=…`. Hyphenated
 *  like the two the Mail recipe writes (`message-id`), and deliberately not a
 *  word the format already has, which `set_prop`'s own rule would refuse. */
export const CAPTURED_BY = "captured-by"

/**
 * What a capture may say: A TITLE AND A NOTE.
 *
 * Two fields, and the shortest version of this schema it has ever had. It
 * carried a `url` — kept as a link under the note, for a page or a message the
 * vault does not hold — and a free `props` map, for the named facts a client
 * already knew. Both are gone (ruled, human 2026-08-23), and "they can return
 * later" is the ruling's own phrase rather than a promise this comment is
 * making.
 *
 * WHAT THE REMOVAL BUYS is not brevity. `props` was the one way a caller could
 * name a property on a capture, which made the door's attribution rule a
 * GUARD — a check that a client had not sent `captured-by` itself, one line
 * from the merge that would have overruled it, with a whole paragraph
 * explaining why the two could not be separated. There is no such field now, so
 * there is no such check: a caller cannot say who captured a thing because
 * there is nowhere to say it. That is the difference between a rule enforced
 * and a rule that cannot be broken.
 *
 * No `target`, no file, no parent, no mark, as before — where a capture belongs
 * is decided in the app afterwards, and a door that could aim would be a door
 * somebody has to configure.
 */
export const CaptureRequest = Schema.Struct({
  /** The row. Verbatim: a blank one is refused by the ops layer in its own
   *  words, which is the sentence an agent's `add_node` gets. */
  title: Schema.String,
  /** The note. Markdown, stored verbatim, exactly as a `desc` anywhere else. */
  text: Schema.optionalKey(Schema.String),
})
export type CaptureRequest = typeof CaptureRequest.Type

/**
 * The note a capture ends up with.
 *
 * It is the text, and now nothing else. It used to be the text followed by the
 * caller's URL on its own paragraph, written as a markdown autolink (`<…>`) so
 * that a `message:` pointer — the scheme the whole arrangement existed for —
 * was drawn as a link rather than as characters. That field is gone with the
 * rest of the link half of this verb; the renderer's side of it is untouched
 * and still tested where it lives (`@olai/web`'s `markdown/sanitise.ts`), so a
 * note that CONTAINS such a link still renders one — nothing here writes one any
 * more.
 *
 * `undefined` for a capture with nothing under it, so a row with no note is a
 * row with no `desc` rather than one with an empty string.
 */
export const noteOf = (posted: CaptureRequest): string | undefined =>
  posted.text === undefined || posted.text === "" ? undefined : posted.text

/**
 * The capture, as the ops layer takes one.
 *
 * WHO IS PASSED IN, and may be nobody. The ruling (human, 2026-08-22, unchanged
 * by the transport moving) is that a door records the identity it HAS and omits
 * the property when it has none: the login a reverse proxy injects on the
 * request, and nothing at all for a door that knows nobody — a direct loopback
 * call, a `just run` with no proxy in front. So `login` is `null` there and the
 * capture simply carries no `captured-by`. That keeps the property meaning ONE
 * thing wherever it appears: somebody the door actually knew. A capture with no
 * attribution is honest; a capture attributed to a process is not.
 *
 * AND IT CANNOT BE SENT, which is now a fact about the schema rather than a
 * check in this function. {@link CaptureRequest} has no property map at all, so
 * there is no forged `captured-by` to refuse — where there used to be a guard
 * here, comparing trimmed keys against the one the write planner would have
 * written, because an exact comparison answered success to `"captured-by "` and
 * then dropped the client's value on the merge below.
 */
export const capturingOf = (
  posted: CaptureRequest,
  login: string | null,
  at: string,
): Capturing => {
  const note = noteOf(posted)
  return {
    title: posted.title,
    ...(note === undefined ? {} : { desc: note }),
    // Dated so it lands on the day's journal page. The stamp is minted by the
    // caller, which is the one impure thing a capture needs and the same `now`
    // every other dated write here is stamped with.
    date: at,
    ...(login === null ? {} : { props: { [CAPTURED_BY]: login } }),
  }
}
