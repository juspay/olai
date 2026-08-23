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
 * ## How full the inbox is ({@link inboxHeldOf}) — the number the door wears.
 *
 * The count is what still awaits processing: a top-level todo or doing, a
 * leaf bullet, or a bare-bullet header that still holds unfinished work (a
 * todo, a doing, or a bullet leaf) in some descendant still in the open
 * part of the branch. A done root does not
 * count, and neither does a finished branch — a header whose every descendant
 * is done. Nested children do not inflate it (a capture with a note under it
 * is still one thing in the inbox), and a mirror does not (a placement is
 * not a capture). Empty, missing, unreadable, only placements, every capture
 * already done, or only finished branches: zero. A file that holds only
 * mirrors, or whose captures are all done or finished branches, is none of
 * empty, missing or unreadable — it still wears zero, because the badge
 * counts captures that await processing, not rows the page draws.
 *
 * A READING of the set, the way `./shelf.ts` is: the browser may not hold the
 * vault, so the server answers this per published revision and the sidebar
 * draws the number (`@olai/surface`'s `inbox` cell). What it is NOT is a
 * second walk of the rows the inbox PAGE draws — those arrive on `page` —
 * because the door has to say how full the file is while somebody is
 * somewhere else.
 */

import { Result, Schema } from "effect"

import { countedChildren, type Derived, rootsOf, unfinished } from "./derive.ts"
import { INBOX, inboxIn, mintedInto, type LocatedRegular, storedMarker } from "./node.ts"
import { type OutlineSet, outlinePaths } from "./set.ts"
import { type OpFailure, UsageFailure } from "./failure.ts"
import type { Capture, WriteRequest } from "./writing.ts"

/**
 * How many captures still await processing, as the wire carries it.
 *
 * ONE INTEGER, and nothing else: which file that is is a fact about the
 * PATHS (`inboxIn` over the directory's names), and the door already reads
 * those. Duplicating the path here would be two answers to "which outline
 * is the inbox".
 */
export const InboxHeld = Schema.Struct({
  /** Top-level regular nodes of the directory's inbox that still await
   *  processing. A todo or a doing counts; a leaf bullet counts; a
   *  bare-bullet header counts only if some descendant still in the open
   *  part of the branch is unfinished. A
   *  done root, and a finished branch, do not. Zero when there is none,
   *  when the file holds nothing, when it would not parse, when it holds
   *  only placements, and when every capture is already processed. */
  count: Schema.Int,
})
export type InboxHeld = typeof InboxHeld.Type

/** No inbox, an empty one, a torn one, a placements-only one, an all-done
 *  one, a finished-branch one, and a server that has never loaded — one
 *  value, because all seven wear no chip. */
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
 * THE NUMBER is what still awaits processing on that file: `rootsOf`, kept
 * only when `awaiting` says the root still has work. A todo or a doing
 * counts; a leaf bullet counts; a bare-bullet header counts only if some
 * descendant still in the open part of the branch is unfinished (a todo, a
 * doing, or a bullet leaf). A nested
 * child does not inflate it, a placement does not, a done row does not, and
 * a finished branch does not.
 */
export const inboxHeldOf = (set: OutlineSet, derived: Derived): InboxHeld => {
  const file = inboxIn(outlinePaths(set))
  if (file === undefined) return NO_INBOX
  const count = rootsOf(derived, file).filter((root) => awaiting(derived, root)).length
  return { count }
}

/**
 * Whether this capture still awaits processing — the one filter
 * {@link inboxHeldOf} applies.
 *
 * A `done` mark is a claim about the whole branch, so it is out. A `todo` or
 * `doing` is unfinished work, so it is in. An unmarked LEAF is an unprocessed
 * line, so it is in. An unmarked node WITH children is a header: it counts
 * only if some descendant still in the open part of the branch awaits,
 * walked through {@link countedChildren} so a placement is never work of
 * this branch's — and a `done` mark prunes the walk, the way the page does.
 *
 * Cycle-safe the way every walk in `./derive.ts` is: a parent loop is a set
 * the validator rejects, and this still has to answer over one.
 */
const awaiting = (derived: Derived, at: LocatedRegular): boolean => {
  const seen = new Set<string>()
  const walk = (node: LocatedRegular): boolean => {
    if (seen.has(node.node.id)) return false
    seen.add(node.node.id)
    const mark = storedMarker(node.node)
    if (mark === "done") return false
    if (unfinished(mark)) return true
    const kids = countedChildren(derived, node.node.id)
    return kids.length === 0 || kids.some(walk)
  }
  return walk(at)
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
 * palette's `⌘K` `+` sends a line, `POST /capture` sends one from a share
 * sheet or a script on the tailnet, and an agent reads the outlines and calls
 * `add_node` or `create_outline` itself (which is why `list_outlines` says the
 * convention in words — the one door that is handed the rule rather than the
 * function). The first two resolve through THIS, and that is the whole reason
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
  const inbox = inboxIn(paths)
  return inbox === undefined
    ? { op: "create", file: mintedInto(INBOX), seed: capture }
    : { op: "add", file: inbox, ...capture }
}

// ── what a capture IS, at whichever door takes one ──────────────────────

/** The property the identity is recorded as. A key rather than a field,
 *  because the format gives it no meaning and olai reads nothing in it — it is
 *  there for the person who captured, and for `prop:captured-by=…`. Hyphenated
 *  like the two the Mail recipe writes (`message-id`), and deliberately not a
 *  word the format already has, which `set_prop`'s own rule would refuse. */
export const CAPTURED_BY = "captured-by"

/**
 * What a capture may say — the ARGUMENTS half, now that the verb is a tool.
 *
 * THREE FIELDS AND A MAP, which is v1's ruling read literally: a title, the
 * text that becomes the note, the URL the capture points back at, and the
 * named facts a client already knows (`from` and `message-id` for the Mail
 * case, which is what makes de-duplicating by `prop:message-id` possible). No
 * `target`, no file, no parent, no mark — where a capture belongs is decided in
 * the app afterwards, and a door that could aim would be a door somebody has to
 * configure.
 *
 * It came down from `@olai/server`'s deleted `capture.ts` with {@link noteOf}
 * and {@link capturingOf} beside it: those three were the half of that door
 * which was about CAPTURING rather than about HTTP, and the tool table needs
 * exactly them. What stayed behind and died with the door was the half that was
 * about the wire — the status table, the CSRF gate, the method arm.
 */
export const CaptureRequest = Schema.Struct({
  /** The row. Verbatim: a blank one is refused by the ops layer in its own
   *  words, which is the sentence an agent's `add_node` gets. */
  title: Schema.String,
  /** The note. Markdown, stored verbatim, exactly as a `desc` anywhere else. */
  text: Schema.optionalKey(Schema.String),
  /** Where this came from, as a link in the note. */
  url: Schema.optionalKey(Schema.String),
  /** The named facts this capture is born with — `add_node`'s `props`. */
  props: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
})
export type CaptureRequest = typeof CaptureRequest.Type

/**
 * An address a caller sent, as a URI a markdown autolink can hold.
 *
 * THE BUG THIS EXISTS FOR, found in review and reproduced against the real
 * renderer: `message://<abc@mail.example>` — the spelling the Mail recipe's own
 * prose uses, since a `Message-Id` is written in angle brackets — closes the
 * autolink at the first `<`. What reached the page was not a broken link but a
 * WORSE one: the remains parsed as a GFM email autolink, so a reader was handed
 * `mailto:abc@mail.example`, a live link composing a new message to an address
 * nobody has. A pointer that silently becomes a different pointer is the one
 * failure this feature cannot have.
 *
 * WHAT IT ENCODES is exactly the characters a URI may not carry at all —
 * `<`, `>`, space, and the C0 controls (RFC 3986) — and nothing else. That
 * narrowness is the whole design: it is a CORRECTION rather than a rewrite, so
 * every legal character survives byte for byte and a client can compare what it
 * sent with what came back; and `%` is deliberately NOT encoded, so an address a
 * careful client already percent-encoded is not double-encoded into a different
 * one.
 *
 * It is not validation and does not pretend to be: what a scheme MEANS is the
 * reader's business (a `message:` opens Mail, an `https:` opens a page, and one
 * the sanitiser does not admit is drawn as text). What it guarantees is
 * narrower and is the whole of what the note needs — that the address survives
 * being written into one.
 */
export const linkable = (url: string): string =>
  url.replace(
    /[<>\u0020\u0000-\u001F\u007F]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  )

/**
 * The note a capture ends up with — the text, and the link under it.
 *
 * THE LINK GOES LAST and on its own paragraph. A note is drawn clamped to one
 * line under a row and expanded on a click (docs/editing.md), so the half a
 * reader sees without asking should be what they wrote rather than sixty
 * characters of URL — and for the Mail case the text is a comment somebody
 * typed and the link is the pointer it is about, which is the order it reads in
 * anyway.
 *
 * A MARKDOWN AUTOLINK (`<…>`) rather than a bare URL, so the link is a link
 * whatever the address looks like: GFM's autolink literals cover `http(s)` and
 * not `message:`, which is exactly the scheme this feature exists for. That is
 * a claim about the READER as much as about this line, and the two ends are
 * held together by a test rather than by a shared constant, because this end
 * names no scheme at all: `@olai/web`'s `markdown/render.test.ts` renders the
 * exact spelling written here and asserts the anchor survives the sanitiser.
 */
export const noteOf = (posted: CaptureRequest): string | undefined => {
  const said = [
    posted.text,
    posted.url === undefined || posted.url === "" ? undefined : `<${linkable(posted.url)}>`,
  ].filter((part): part is string => part !== undefined && part !== "")
  return said.length === 0 ? undefined : said.join("\n\n")
}

/**
 * The capture, as the ops layer takes one.
 *
 * THE IDENTITY IS THE LAST WORD, and this function is where the rule that makes
 * that safe LIVES rather than being a check somewhere above it: a client that
 * sends {@link CAPTURED_BY} itself is refused HERE, one line from the merge
 * that would otherwise have overruled it. Split apart — a guard at the door, a
 * spread down here — the two were held together by nothing but the order they
 * happened to be written in, and deleting the guard would have left a door that
 * succeeds on a forged attribution it silently rewrote.
 *
 * WHO IS PASSED IN, and may be nobody. The ruling (human, 2026-08-22) is that a
 * door records the identity it HAS and omits the property when it has none:
 * the login header on an HTTP or websocket face, the OS user on the unix
 * socket, and nothing at all for the in-process MCP face — so `login` is
 * `null` there and the capture simply carries no `captured-by`. That keeps the
 * property meaning ONE thing wherever it appears: somebody the door actually
 * knew. A capture with no attribution is honest; a capture attributed to a
 * process is not.
 *
 * A `Result`, and a `UsageFailure` inside it: the request itself is wrong,
 * nothing was read and nothing was written. That is also what puts this refusal
 * on the same answer, in the same shape and with the same word, as every refusal
 * the ops layer makes — rather than in a sentence of this function's own.
 *
 * THE KEYS ARE COMPARED TRIMMED, and that is not tidiness: the write planner
 * TRIMS a property key before it writes it (`@olai/ops`' `plan.ts`), so
 * `"captured-by "` is the same key by the time it reaches the file. An exact
 * comparison answered success to that and then dropped the client's value on
 * the merge below — the "recorded exactly as sent when it was not" outcome this
 * whole function exists to have refused. Found in review.
 */
export const capturingOf = (
  posted: CaptureRequest,
  login: string | null,
  at: string,
): Result.Result<Capturing, OpFailure> => {
  if (Object.keys(posted.props ?? {}).some((key) => key.trim() === CAPTURED_BY)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${CAPTURED_BY}\` is written from the identity this door already ` +
          "has and cannot be sent: it is who captured this, and a capture may not " +
          "say that about itself",
      }),
    )
  }
  const note = noteOf(posted)
  return Result.succeed({
    title: posted.title,
    ...(note === undefined ? {} : { desc: note }),
    // Dated so it lands on the day's journal page. The stamp is minted by the
    // caller, which is the one impure thing a capture needs and the same `now`
    // every other dated write here is stamped with.
    date: at,
    props: {
      ...posted.props,
      ...(login === null ? {} : { [CAPTURED_BY]: login }),
    },
  })
}
