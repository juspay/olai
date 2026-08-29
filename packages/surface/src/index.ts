/**
 * @olai/surface — the typed reactive layer, declared once for both ends.
 *
 * The server implements this and the browser subscribes to it; neither writes
 * a line of wire code. That is the rule carried over from the htmx era: no raw
 * sockets, no hand-rolled routes, no message envelopes — the only protocol is
 * this spec, and both sides are type errors away from disagreeing about it.
 *
 * Three members are the outline, which is the whole of "see your outline" and,
 * once the store went live, of "watch it stay right" as well:
 *
 *   - `outlines` is a COLLECTION keyed by root-relative path, read-only on the
 *     wire: the files belong to the disk, not to the server, so the server
 *     reports what it read rather than owning a value it could be asked to
 *     change. One entry per outline FILE, so editing one line of one file sends
 *     that file's slice and not the corpus, and the key is DECLARED
 *     (`keySchema`) rather than inherited from a client library's default.
 *     Every subscription opens with a full snapshot and a reconnect is a fresh
 *     one — the framework's own contract — so there is nothing to resume.
 *
 *     NO BROWSER READS IT any more, and that is PR 10 of
 *     `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` landing: a tab held every record
 *     of every file and answered every page out of its own copy, which is the
 *     ruling this arc reversed ("the browser may hold at most the current
 *     page's data"). What a tab reads now is the `page` stream below and the
 *     `heads` beside it. The member stays, on the AGENT's face
 *     (`@olai/server`'s `faces.ts`): watching one outline's records is exactly
 *     what a request-shaped reader wants, and it was never the problem.
 *   - `documents` is a COLLECTION keyed the same way, one entry per BODIED file
 *     — every `.md` and every `.html` — and it is subscribed KEYS-FIRST: the sidebar draws paths, so the key set is
 *     the whole of what a first paint needs, and a body travels when a document
 *     is opened (the per-key `get`). No `deltas` — the batched verb is a push
 *     of every entry, which for documents is every body, which is the thing
 *     this collection exists to stop sending.
 *   - `heads` is that same key set with the bodies taken out — one revision per
 *     bodied file — and it is where a reader goes to learn a file MOVED
 *     without asking what it now says. It is the member `documents` cannot be:
 *     cheap enough per entry to carry `deltas`, so one stream tells a tab about
 *     every file at once. A previewed `.html` is the case it was built for —
 *     its frame fetches the file over HTTP and reads no body off the wire at
 *     all.
 *   - `manifest` is a CELL: the set-wide facts that belong to no one file, and
 *     the answer to "is there a set at all". Its `null` is the state a
 *     collection cannot express — an empty snapshot means "this directory has
 *     no outlines", and a first probe still running has to say something else.
 *   - `errors` is a CELL, read-only on the wire, because "what is wrong right
 *     now" is one value the server does own. It is deliberately independent of
 *     the entries: a set that stops validating leaves the last good tree on
 *     screen underneath a banner, which is only expressible if the two arrive
 *     separately.
 *   - `git` is a CELL, for the same reason and about the other half of what a
 *     write costs: whether this directory is a repository, and whether the last
 *     commit worked. A directory that is not one, or a git that cannot be run,
 *     is news a reader is owed rather than a line in a server log
 *     ({@link GitState}).
 *   - `pins` is a CELL, and it is the first member here that carries a READING
 *     of the set rather than the set: the sidebar's shelf, recomputed per
 *     revision and sent when it changed by value. It is where
 *     `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` is going — the browser is handed
 *     what it draws instead of every record it would have had to walk to work
 *     it out.
 *   - `inbox` is that same kind of cell, one integer over: how many top-level
 *     captures the directory's inbox holds. No argument (it is a fact about
 *     the directory, not about the reader), so it is not a stream the way
 *     `owed` is. The door that wears the number already knows which file that
 *     is, from the paths.
 *
 * Who is on the other end is NOT a member here, and it was for one commit. The
 * question is real — a page bound to a replaced server must know — but the
 * framework reserves `system/identity` for it and answers it out of every
 * surface, process id included, so an app that declares its own is declaring a
 * second answer to a question already answered (juspay/kolu#2133). Who is
 * LOOKING is a different question: it is per CONNECTION, not per process, so
 * it is a PROCEDURE (`who.get`) rather than a cell — the login is stamped on
 * the upgrade and does not move for the life of the socket, which is nothing
 * to subscribe to. `GET /olai/who` stays for the plain-HTTP doors. The
 * reading is `@olai/identity`'s `identityOf`; which headers the upgrade
 * named is the serve's.
 *
 * Beside it is WHAT THIS DEPLOYMENT IS CALLED, and WHEN THIS PROCESS
 * STARTED: two facts about the process rather than about a connection,
 * `app.get` (`./app.ts`). The box's name cannot cross any other way — a
 * browser cannot know its server's `os.hostname()`, and a static shell
 * ships before the server exists — so it arrives the way every other
 * server-side fact in this spec arrives, over this socket. The start
 * instant is the same kind of crossing: a tab that timed from its own
 * open would lie even with perfect clocks, and a duration on the wire
 * would have to be polled. The tab's title, the header's wordmark and the
 * install manifest's `name` all draw the one spelling the name answers
 * with; the header's quiet uptime chip ticks from the instant.
 *
 * One more is GIT, and it is a cell with two verbs beside it rather than a
 * member: a `pending` cell — what is waiting to be committed, and what is
 * committed and not pushed, derived from git on the server and never stored —
 * plus `git.commit` and `git.push`, which are the Commit and Push buttons' half
 * of the same two actions the agent reaches through MCP tools. They are
 * PROCEDURES rather than write verbs on the cell because each is an act with
 * four answers, three of which are refusals a reader has to be shown.
 *
 * Three more are the chat, and they are declared next door in
 * {@link ./chat.ts} because they are a subject of their own: a `transcript`
 * COLLECTION (batched deltas, so a late-joining tab sees the conversation), a
 * `chat` CELL (session, model, commands, whether a turn is running, whether it
 * is blocked on a question) and the `chat` PROCEDURES (send, resend, cancel,
 * new, load, list, attach, and the two that answer a question). The agent's
 * WRITES do not
 * appear here at all: they reach the ops layer through an internal MCP server
 * the session is handed, and what a reader sees of them is the outline stream
 * moving — server-authoritative, never an optimistic echo.
 *
 * Four members are STREAMS, which this surface had none of until PR 4 of
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`. A stream is a CELL WITH AN
 * ARGUMENT — read, listen, re-read on every published revision, send only when
 * the answer moved — and an argument is exactly what each of them needs and a
 * cell cannot have:
 *
 *   - `dated` and `owed` are the sidebar's month of dots and its count of what
 *     is late: a month somebody paged to, and the day somebody is standing on.
 *     Their vocabulary is {@link ./dates.ts}.
 *   - `page` is THE member of this whole design — what one open page shows, for
 *     the address it is showing. Its vocabulary, and the argument for the
 *     shape, is {@link ./page.ts}.
 *   - `moving` is beside it: whether a row can go where somebody is pointing,
 *     which is the one question left in the app that is about the vault and not
 *     about any page.
 *
 * FOUR MEMBERS DECLARE WHAT IDENTIFIES A ROW — `page` by `key`, `pins` by
 * `id`, `pending` by `path`, `chat` by `name` — and that is the one thing about
 * this spec that is not about the wire at all. `arrayKey` is read where a
 * browser MERGES a frame into its store (`@kolu/surface`'s `writeValue.ts`,
 * juspay/kolu#2190): undeclared, a frame replaces every element of every array
 * it merges, so a frame that merely repeats what a tab already holds still
 * notifies every reader of every row — which is the whole of
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md` §2's Fact B. Declared, an
 * identical frame notifies nothing and a reorder moves the objects a keyed view
 * follows. It is one field per member, reaching every array at every depth;
 * arrays whose elements do not carry it merge by POSITION, which is silent on a
 * repeated frame just the same. The members that declare NOTHING each say why
 * where they are declared, and three of them share one reason worth stating
 * here: `outlines`, `heads` and `transcript` are read through the batched
 * `deltas` delivery, which replaces each named leaf WHOLE rather than merging
 * into it — a `fold` consumer may be holding that very object — so there is no
 * merge there for a key to govern. `documents` is served per key and would
 * honour one; a document entry is a revision and a body, and holds no array.
 * `manifest`, `git`, `dated`, `owed`, `inbox` and `moving` carry no array of
 * OBJECTS at all — an empty struct, two strings, a list of day strings, two
 * integers, one integer, and a nullable row beside a list of nullable
 * strings — so there is nothing there for identity to be about. `surface.test.ts` reads the declaring set off this
 * spec rather than off a list, so the sentence above is checked rather than
 * kept by hand.
 *
 * The last group is the KEYBOARD's ({@link ./edit.ts}), and it is the one
 * place a browser may cause a write. It changes nothing about the paragraph
 * above: an edit is a PROCEDURE, the collections stay read-only on the wire,
 * and what a reader sees is still the file that was produced arriving on the
 * outlines stream. So a person typing and an agent writing are the same
 * mechanism seen twice, and two tabs cannot disagree about what landed.
 *
 * And one group is the AGENT's ({@link ./ops.ts}) — the ops request vocabulary
 * itself, which is what lets an HTTP `/mcp` client write through the running server instead of
 * opening the same directory a second time. It is the one group NO browser may
 * reach, and saying that is possible for the first time: every serving face
 * takes its own allowlist since juspay/kolu#2170, so a verb is open on the
 * socket an agent dials and closed on the websocket a tab opens. Which face
 * gets what is `@olai/server`'s to decide; this spec only says what exists.
 */

import {
  BrokenFile,
  CommitRequest,
  CommitResult,
  Face,
  GIT_OFF,
  GitPin,
  GitPolicy,
  GitState,
  HomesAnswer,
  HomesRequest,
  InboxHeld,
  Located,
  NamedAnswer,
  NamedRequest,
  NO_INBOX,
  NO_PINS,
  NOTHING_PENDING,
  NOTHING_WRONG,
  Pending,
  PolicyRequest,
  PushResult,

  sameGit,
  sameInboxHeld,
  samePending,
  sameShelf,
  Shelf,
  TagsAnswer,
  TagsRequest,
  Verdict,
} from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Effect, Schema } from "effect"

import {
  AskAnswer,
  AttachChunk,
  Attached,
  CHAT_OFF,
  ChatEntry,
  ChatFailure,
  ChatServer,
  ChatState,
  OpFailure,
  Conversation,
  Listed,
  sameStanding,
  Saying,
  ServerStanding,
  SessionInfo,
  Unreachable,
} from "./chat.ts"
import { editProcedures } from "./edit.ts"
import { opsProcedures } from "./ops.ts"
import { DatedAnswer, DatedRequest, Owed, OwedRequest } from "./dates.ts"
import { MovingAnswer, MovingRequest, PageReading, PageRequest } from "./page.ts"
/** KOLU'S SLICE, contributed rather than declared here — Design B, the sixth
 *  sitting. The four members spread into their own sections below; the types
 *  are re-exported at the tail, so a consumer still reads them off the composed
 *  spec and no import outside this package changed. */
import { koluMembers } from "@olai/kolu-client/wire"
import { App } from "./app.ts"
import { NarrowingAnswer, NarrowingRequest } from "./narrowing.ts"
import { SearchAnswer, SearchRequest } from "./search.ts"
import { Who } from "./who.ts"

/**
 * One outline file's slice of the set, as published at set revision `rev`.
 *
 * Exactly one of `nodes` / `broken` is meaningful: a file that stopped parsing
 * keeps its key and carries its errors, which is the per-entity half of the
 * error scope expressed as DATA rather than by absence. A reader that had only
 * the `errors` cell would have to guess which outline a `file:line` belonged to
 * and hope the two lists agreed.
 *
 * `rev` is the SET's revision at the moment this entry was published, and it
 * travels per entry rather than per frame for one reason and against one
 * expectation. The reason: a phase-4 write names it as the base it edited, and
 * the base a write is derived from is the revision the entry it read was at.
 * The expectation it defeats is that all the entries on screen share it — see
 * the cross-file consistency paragraph in
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/outlines-as-collection.md`. Only the files that MOVED in
 * a tick are upserted, so an unchanged neighbour keeps the older number until
 * something changes it.
 *
 * WHICH MAKES IT THE CHANGE TOKEN, and that is a contract rather than an
 * accident of the implementation, because two readers rest on it: this number
 * moves when THIS FILE's records move and at no other time. A write names the
 * revision it edited as its base, and `Head.rev` is how a page WATCHES one file
 * it does not draw — a preview waiting for its `.html` to move — without asking
 * for the body. So an entry rebuilt at a new revision for a file that did not
 * change costs a reader wasted work, and an entry whose records changed
 * published at a revision a reader already holds is a view that is silently
 * stale. `@olai/server`'s `published.ts` is what keeps it (an entry is rebuilt
 * exactly when the store re-decoded its path), and `published.test.ts` is where
 * that is pinned.
 *
 * WITHIN ONE PROCESS, which is the other half of the same promise: these
 * numbers are a counter, so a tab comparing two servers' counters would be
 * comparing nothing. It cannot: the socket echoes the process id it was given
 * and a server that does not recognise itself retires the tab
 * (`packages/tests/features/the_connection.feature` restarts a server under a
 * live tab and asserts exactly that, plus the reload that recovers it). So a
 * reader COMPARING these numbers — a write against the base it read, a page
 * against the revision it last saw — is always comparing within the run that
 * minted them.
 */
export const OutlineEntry = Schema.Struct({
  rev: Schema.Int,
  /** This file's nodes only, in file order. Empty for a file that did not
   *  parse, and empty for one that holds nothing — the difference is `broken`. */
  nodes: Schema.Array(Located),
  broken: Schema.NullOr(BrokenFile),
  /** What this file IS, apart from what it holds: its title, the addresses it
   *  points at, the tags its records write (`@olai/format`'s `Face`).
   *
   *  It rides here rather than being derived on arrival, and that is a cost
   *  decision rather than a doctrinal one: a browser CAN build an outline's
   *  face — it holds the records and the format's own constructor — but doing
   *  so is a walk of every title and every note of the corpus per revision,
   *  where the server built this once when the file's bytes changed. The
   *  face is small; the walk is not. */
  face: Face,
})
export type OutlineEntry = typeof OutlineEntry.Type

/**
 * One bodied file's slice of the set, as published at set revision `rev`.
 *
 * The entry carries the BODY, and it is the only thing on the wire that does:
 * one collection, keyed by path, read one key at a time. What it replaced was
 * a `documents` array on {@link Manifest} — every served document's full text
 * in the FIRST frame of every subscription, ~124 KB of a ~212 KB snapshot for
 * this project's own `docs/`, and O(corpus) for a directory of thousands.
 * What changed then was when a body travels — when someone opens it — and
 * nothing about the SET: it went on holding every body it had read.
 *
 * It does not any more, and that is the second half of the same idea: a `.html`
 * is served from a read of its own and its bytes are kept by nobody
 * (`@olai/format`'s `kinds.ts` decides which kinds, `@olai/server`'s
 * `bodies.ts` does the reading), so this entry's `text` can be `null` — see
 * below. What is unchanged, and load-bearing, is that the server still holds
 * every served PATH and validates every `doc` against it (`docs/format.md`).
 *
 * `rev` is the set's revision at the moment this entry was published, for the
 * reason {@link OutlineEntry}'s is: a body now arrives on its own frame, so
 * "which moment of the directory am I reading" is a question a reader can
 * actually ask, and the answer is a number rather than an assumption. An
 * unchanged document keeps the entry it was published with, so the number does
 * not move under a reader who is not looking at a changed file.
 *
 * There is no `file` field: the KEY is the path. A second copy of it here is a
 * second spelling of one fact, and the two could disagree.
 *
 * THREE STATES, and they are not two plus a boolean. `text` a string is the
 * body. `text: null` and {@link DocumentEntry.refused} false is the body not
 * here — a `.html` the set keeps only the path of, or a key announced before
 * its bytes have been read. `refused` true is a READ that was attempted and
 * the file would not open: the key is here, the bytes are not, and that is a
 * fact about THIS file rather than a reason to fail the whole probe. Exactly
 * one of a body and a refusal is the news; a reader that folded `refused`
 * into `text ?? ""` would draw a blank page for a file that had something to
 * say.
 */
export const DocumentEntry = Schema.Struct({
  rev: Schema.Int,
  /**
   * Verbatim, exactly as on disk — markdown or markup, interpreted at view
   * time by whichever face this kind of file is drawn with.
   *
   * `null` is a STATE and not an absence, the way {@link Manifest}'s is: this
   * file is served and its body is not here. It is what a server holding only
   * the PATH of a `.html` says about one to itself — the set does not keep a
   * saved page's bytes for the life of the process (`@olai/format`'s
   * `kinds.ts`) — and it is admitted by this schema because that projection is
   * typed by it.
   *
   * A reader ASKING FOR ONE is not shown it. A per-key `get` for a body the
   * server does not hold answers nothing until the file has been read, which is
   * the framework's own held-open-on-absent path: a browser waits one read
   * rather than being told the body is missing, and a one-shot reader (an
   * agent's `resources/read`, which takes the first frame and leaves) is handed
   * the file rather than a `null`. The other way every entry could travel — the
   * batched `deltas` verb — is exactly what this collection does not have.
   *
   * ONE frame can still carry it, and it is worth being exact about which: the
   * upsert that ANNOUNCES a key, for a file that has just appeared in the
   * directory. That frame is how a collection says its membership changed, and
   * it reaches anyone already subscribed to that key — which can only be a
   * reader who asked for a file before it existed. It says what it says: the
   * file is here, its body is not yet. A reader folds it the way it folds an
   * entry that has not arrived, and hears the body on a later frame or on its
   * next read.
   *
   * A READ THAT WAS REFUSED is the other `null`, and it is not this one. See
   * {@link DocumentEntry.refused}.
   */
  text: Schema.NullOr(Schema.String),
  /**
   * Whether a READ of this body was attempted and the file would not open.
   *
   * `false` for every file whose body is here, and for every file whose body
   * is not here yet — the projection of a `.html` the set keeps only the path
   * of. `true` is the third state this entry can be in: the file is served, a
   * reader asked for its bytes, and the disk said no. It is not a parse
   * failure ({@link Head.broken} / {@link OutlineEntry.broken} — those are
   * decode failures, and a file that cannot be opened never reaches them) and
   * it is not an absence (the key is here). The blast radius is this file:
   * what it replaced was a probe that failed the WHOLE directory over one
   * unreadable saved page.
   *
   * Produced where the read happens (`@olai/server`'s `bodies.ts` for a body
   * the set does not keep; the probe, for a kept `.md` that will not open)
   * and answered the same way on the HTTP face (`@olai/server`'s `media.ts`)
   * so the two tell one story. The sentence both faces draw is
   * {@link BODY_REFUSED}.
   *
   * A one-shot reader (an agent's `resources/read`) is handed this frame
   * rather than being held open until a body that will never come. That is
   * the held-open-on-absent path closed for a read that failed, rather than
   * only for a read that succeeded.
   *
   * OPTIONAL on the wire, default `false`, so the two mismatched ends are
   * both legal: an old client drops a field it does not know (and degrades
   * to the blank body it always drew), and a new client reading a frame
   * that never carried one treats it as not refused. In-repo the two ends
   * ship from one commit; this is the public wire's answer for a raw
   * client that does not.
   */
  refused: Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
})
export type DocumentEntry = typeof DocumentEntry.Type

/**
 * One SERVED FILE's HEAD: which revision of the directory it is at, what it is
 * called, and whether it could be read at all. Everything about a file except
 * its content.
 *
 * It exists because "the file on disk MOVED" and "here is what it says" are
 * two different questions, and until this member there was one way to ask
 * both. A `.html`'s page draws from a frame that fetches the file over HTTP
 * (`./seal.ts`), so the only thing it wants from the wire is the first
 * question — and asking it through {@link DocumentEntry} sent a saved page's
 * megabytes to a tab that drew none of them, on every open and on every edit,
 * ahead of the fetch that actually drew it. That was PR #206's standing
 * deferral, and this is the member it named.
 *
 * EVERY served file since PR 10 of `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`,
 * where it was every BODIED one. That is the design's §3 Sidebar row arriving:
 * the file tree is paths and faces, which is key-set-sized, and it was the only
 * thing a browser still read the whole `outlines` collection for. An outline's
 * head is exactly what a document's always was — a revision and a face, no
 * content — so this is one member widened rather than a second one built beside
 * it, and the browser now learns the DIRECTORY here and each PAGE from its own
 * reading (`./page.ts`).
 *
 * `rev` is {@link OutlineEntry}'s and {@link DocumentEntry}'s, unchanged and on
 * purpose: it MOVES when the file does and stays put when it does not, so a
 * reader watching it is watching this one file rather than the directory's
 * clock. A page rewritten with the bytes it already had does not move it —
 * nothing re-decoded it — and a megabyte string never has to be compared to
 * find that out.
 *
 * There is no `file` field, for {@link DocumentEntry}'s reason: the KEY is the
 * path. And there is no second fact in here waiting to be useful — a head that
 * grew a size, a modified time or a hash would be a second answer to a question
 * `rev` already answers, kept in step by hand.
 */
export const Head = Schema.Struct({
  rev: Schema.Int,
  /** What the file IS, apart from what it says: its path, its title, the
   *  addresses it points at, the tags it writes (`@olai/format`'s `Face`).
   *
   *  IT CARRIES ITS OWN PATH, and the paragraph above forbids exactly that of
   *  the entry — so the difference is worth naming. A `file` FIELD beside the
   *  key would be one fact spelled twice by two hands; a face is one VALUE the
   *  format made, whose identity is its path, cut from the same document in the
   *  same function as the key it arrives under (`@olai/server`'s
   *  `published.ts`). What the browser then holds is a list of faces
   *  (`@olai/web`'s `page.ts`), where a key is not in hand — taking the path
   *  off here would mean re-attaching it on arrival, which is the second hand.
   *
   *  THE ONE FACT THAT MAY JOIN `rev` HERE, and it is worth saying why, since
   *  the paragraph above forbids a second answer to a question `rev` already
   *  has. A size, a modified time or a hash would each be one of those. A face
   *  is not: it is what the file SAYS, which is the question this member could
   *  not be asked before — and a browser cannot derive it the way it can an
   *  outline's, because the body it would read is the one thing this collection
   *  exists to keep off the wire. Without it a document is a PATH to every tab
   *  in the app, which is the position the whole first-class-documents arc is
   *  about. It moves when `rev` moves and by the same act, since both are cut
   *  from one document in one function (`@olai/server`'s `published.ts`). */
  face: Face,
  /**
   * Why this file could not be READ — `null` for every file that parsed, and
   * for every file that has no parsing to do.
   *
   * The one field here that is not about a file's identity, and it is here for
   * the reason the face is: it is what a browser cannot derive without the
   * content. A `.olai` that stopped parsing keeps its key and carries its
   * errors — the per-entity half of the error scope expressed as DATA rather
   * than by absence, which is the same sentence {@link OutlineEntry.broken}
   * makes and the same value, cut from the same set. The sidebar marks such a
   * file and its own page draws the errors instead of a tree; a reader holding
   * only the `errors` cell would have to guess which outline a `file:line`
   * belonged to and hope the two lists agreed.
   *
   * It rides on the HEAD rather than on the page's reading because the sidebar
   * marks every broken file in the directory, not the one somebody is looking
   * at — and it is a boolean's worth of weight per file, which is what the rest
   * of this entry already costs.
   */
  broken: Schema.NullOr(BrokenFile),
})
export type Head = typeof Head.Type

/**
 * Whether there is a set at all, and nothing else.
 *
 * `null` is a state, not an absence, and it is the one thing the collections
 * cannot say. Three things a reader must tell apart — "the server has not
 * answered yet" (no frame at all), "the server has never had a valid set to
 * show" (`null`), "here is your directory" (a value) — and an empty collection
 * snapshot is the SECOND and THIRD at once unless something else carries the
 * bit. This is that something, and being that is its whole job.
 *
 * So the value carries NOTHING. It used to carry the documents, which is what
 * {@link DocumentEntry} was cut out of it to stop; what is left is a fact with
 * no fields, because every fact about this directory now belongs to a file and
 * travels on that file's entry. A set revision here would be the obvious thing
 * to reach for and is deliberately absent twice over: nothing reads it, and it
 * moves on every revision, so it would wake every open tab's derivation — the
 * cell that is quiet is the point of {@link sameSet}.
 */
export const Manifest = Schema.NullOr(Schema.Struct({}))
export type Manifest = typeof Manifest.Type

/** A directory that has loaded, as the one value there is of it. */
export const LOADED: Manifest = {}

/**
 * What git is doing for the served directory.
 *
 * A member because of a bug: writes came back `committed: false` with nothing
 * on screen saying so, on a directory its owner knew was a repository, and the
 * reason went to the server log where a browser reader never sees it. Every
 * cause looked the same from out here — no work tree, no git on the service's
 * PATH, a refused commit, an identity nobody set — so the page could not have
 * told the truth even if it had wanted to. Now the server says which, and the
 * four states are four different things to draw — on the ONE control the header
 * has for git, which reads this beside `pending` (`web/src/client/commit/`):
 *
 *   - `off` — `--no-commit`. An owner's choice, so it is drawn as a setting:
 *     dim, inert, and never a warning.
 *   - `repo` — a work tree, and writes are committing. Quiet: this is the
 *     healthy default and a page that shouted it would teach a reader to
 *     ignore the thing that matters.
 *   - `none` — not a work tree. Calm and informational: "no git here".
 *   - `error` — git tried and could not, and `said` is its own words. The one
 *     face that warns, and the words ride its tip and its `aria-label`.
 *
 * It carries a FIFTH fact that is not one of those four and is not about the
 * repository at all: `pinned`, which is the `--commit` / `--push` flags this
 * server was started with, `null` for each one nobody gave. It rides this cell
 * rather than a cell of its own because the preferences panel that draws it is
 * drawing the same server's answer about the same directory, and `off` above is
 * already exactly that answer wearing the repository's clothes. What a browser
 * does with it — freeze the two git preference rows, read-only, naming the flag
 * — is `web/src/client/settings/`.
 *
 * A CELL, and read-only on the wire, for the reason the manifest is: one value
 * the server owns, about the directory rather than about any file in it. It
 * moves twice at most in an ordinary serve — once when the directory is probed,
 * and again if a commit ever refuses — so nothing here is a stream of anything.
 *
 * The shape is `@olai/format`'s, re-exported rather than declared, the way
 * `Pending` and `RepoState` are — one declaration on the floor this spec and
 * the ops layer both stand on, so there is no second spelling to drift. Its
 * before-first-frame default `GIT_OFF` travels with it.
 */
export { GIT_OFF, GitPin, GitPolicy, GitState, PolicyRequest }

/** When two answers are the same answer, so the cell can stay quiet. There is
 *  exactly one thing this value can say, so there is exactly one thing that can
 *  change about it: whether there is a set. */
const sameSet = (a: Manifest, b: Manifest): boolean => (a === null) === (b === null)

export const surface = defineSurface({
  cells: {
    ...koluMembers.cells,
    // Wire-read-only: the server is the only writer, and a write verb it never
    // serves would crash surface's boot walk.
    errors: {
      /**
       * THE VALIDATOR'S VERDICT, as the format shapes it (`@olai/format`'s
       * `verdict.ts`) — not the flat list of rows this used to be.
       *
       * The rows are still in it and still travel whole, because the surface
       * that has to show every one of them is a REAL surface: a directory that
       * never loaded has no tree to put a banner over, so the error page is the
       * page and nothing may be summarised away. What changed is that a surface
       * drawn over something still live no longer has the rows as its only
       * option — `summary(n)` is a bounded per-file face, and the banner draws
       * that (`@olai/web`'s `errors/Banner.tsx`, and `last-good-banner-flood`
       * for what drawing the rows there cost).
       *
       * NO `arrayKey`, and it is a decision rather than an omission — the one
       * cell here with a list a `<For>` draws by reference and nothing to
       * identify a row by. An `OutlineError` is a site, a code and a sentence;
       * `file` is the only required, non-nullable field that looks like an
       * identity and a broken outline reports several errors against the same
       * one. A key that repeats inside its own array is a key that decides
       * identity by collision, so this merges the way an undeclared list does:
       * replaced. (It is a struct now rather than a list, so the question is
       * settled a second way — a cell whose value is a struct is replaced.)
       */
      schema: Verdict,
      default: NOTHING_WRONG,
      verbs: ["get"],
    },
    /** Whether there is a set — see {@link Manifest}. Wire-read-only for the
     *  same reason the entries are: the directory is the disk's.
     *
     *  `equals` is what keeps it quiet: the server writes this cell on every
     *  revision, because that is when it learns anything, and almost every
     *  revision has nothing new to say about whether a directory loaded. */
    manifest: {
      schema: Manifest,
      default: null,
      verbs: ["get"],
      equals: sameSet,
    },
    chat: {
      schema: ChatState,
      default: CHAT_OFF,
      verbs: ["get"],
      /** A COMMAND AND A TOOL SERVER ARE EACH THEIR `name` — the two arrays
       *  this cell carries, and both spell their identity the same way
       *  (`./chat.ts`'s `Command.name` and `ChatServer.name`, required and
       *  non-nullable).
       *
       *  This cell has no `equals`, and it moves for reasons that have nothing
       *  to do with either list: a turn going `idle → thinking`, a `usage`
       *  update per report, an `asking` count. Every one of those frames used
       *  to replace every command and every server row — so
       *  `chat/Roster.tsx`'s `<For each={servers()}>`, which is keyed by
       *  reference, rebuilt the panel a reader was in the middle of reading,
       *  mid-turn, on every token report. The roster is drawn on EVERY
       *  conversation now rather than only on a broken one, so what that key
       *  buys has gone from rare to permanent. */
      arrayKey: "name",
    },
    /** What git is doing for this directory — see {@link GitState}. Wire-read-only:
     *  it is the server's reading of somebody's working tree, and nothing a
     *  browser could set. Derived from the same survey {@link pending} is, so
     *  the one control that reads both cannot contradict itself. */
    git: {
      schema: GitState,
      default: GIT_OFF,
      verbs: ["get"],
      /** The same `equals` the pending cell below declares, and the omission it
       *  is fixing is the pair coming apart: both are recomputed from ONE
       *  survey by ONE statement, on every revision AND on the server's
       *  thirty-second sweep, and a derivation is a fresh object every time. So
       *  without this a healthy repository framed every open tab twice a minute
       *  saying `repo` — which is what restarted the quiet window on a frame
       *  nobody typed, back when that window lived in a browser tab. It is the
       *  server's now, and re-arms on a reading that says something new
       *  rather than on a frame (`@olai/format`'s `armedOn`), so this is the
       *  wire staying quiet rather than the loop's only defence. */
      equals: sameGit,
    },
    /**
     * What is waiting to be committed — the count in the chrome, and every row
     * the Commit panel draws.
     *
     * A CELL because it is one value about the whole served directory, and
     * wire-read-only because it is DERIVED: the server recomputes it from git
     * on every published revision and on a slow sweep of its own (nothing
     * watches `.git`), and a browser that could write it would be a browser
     * holding a second answer to a question git already answers.
     *
     * Its default is the empty one rather than `null`, and there is no third
     * state to tell apart: a page that has not heard yet, a directory that is
     * not a repository and a server with `--commit=off` all draw the same
     * thing, which is nothing at all.
     */
    pending: {
      schema: Pending,
      default: NOTHING_PENDING,
      verbs: ["get"],
      /** The server recomputes this on a timer as well as on every revision,
       *  and a derivation is a fresh object every time — so without an
       *  `equals` every open tab would get a frame every thirty seconds
       *  saying exactly what it already knew. */
      equals: samePending,
      /** A DIRTY ROW IS ITS `path` — and the two lists of rows this cell
       *  carries agree about that already, deliberately: `@olai/format`'s
       *  `Other` docstring says `path` "is spelled the same as
       *  {@link DirtyOutline}'s `path` and means the same thing… the two lists
       *  are two kinds of ROW and one namespace of keys". One declaration
       *  therefore keys both, which is what one field per member needs.
       *
       *  What it stops: `commit/Outlines.tsx` and `commit/Others.tsx` both draw
       *  `<For>`, which is keyed by REFERENCE, so a frame that named one newly
       *  dirty file tore down and rebuilt every other row of the panel — every
       *  tick somebody had put in it among them. `changes` and `wrote` carry no
       *  `path` and merge by position, which is what their consumers read them
       *  as.
       *
       *  `file` IS THE NEAR-MISS, and it is refused for `errors`' reason rather
       *  than on taste: it keys `outlines` too, and it REPEATS inside `changes`
       *  — `@olai/format`'s `changesOf` matches by id ACROSS files, so several
       *  node changes share one — which is a key deciding identity by
       *  collision. `surface.test.ts` pins that it would have keyed `changes`,
       *  so the reason this field and not that one is a fact rather than a
       *  memory. */
      arrayKey: "path",
    },
    /**
     * THE PINNED SHELF — the rows of the directory's `Pins.olai`, and the live
     * name of whatever node each one addresses (`@olai/format`'s {@link Shelf}).
     *
     * A CELL, which is to say a STANDING answer with no argument. The shelf is
     * a reading of the whole vault — which file the shelf is, that file's top
     * level, and a name that may live in any other file — and it was the
     * browser's own walk over its copy of every outline until PR 5 of
     * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`. Nothing about it depends on who
     * is asking or on what they are looking at, so there is no input to give a
     * stream and no question to make a procedure of: the server recomputes it
     * on every published revision and sends it when it changed by value, which
     * is §2's mechanism sentence exactly.
     *
     * RE-ANSWERED PER REVISION IS THE FEATURE, not an optimisation. A bare pin
     * stores an address and never a name, so what the shelf draws for `/#herbs`
     * is that node's title RIGHT NOW — rename it anywhere, by anyone, and the
     * new name is on the shelf on the frame the store publishes, because there
     * was never a second copy of it to go stale.
     *
     * `equals` is what keeps that from costing anything: the reading mints a
     * fresh array per revision, and almost every revision has nothing new to
     * say about a shelf of five doors.
     *
     * WIRE-READ-ONLY, like every other file-shaped member: a pin is a row in an
     * ordinary outline, and the only way to write one is the ops layer — which
     * is what a pin, a reorder and an unpin already resolve to.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`): an agent reads the
     * shelf as the ordinary outline it is.
     */
    pins: {
      schema: Shelf,
      default: NO_PINS,
      verbs: ["get"],
      equals: sameShelf,
      /** A PIN IS ITS NODE'S ID — `@olai/format`'s `Pinned.id`, the pin
       *  record's own id, required and non-nullable.
       *
       *  `equals` above and this are the two halves of one sentence, and they
       *  are not the same half. `equals` decides whether a frame is SENT: a
       *  revision that moved no pin says nothing to anybody. This decides what
       *  a frame that IS sent is allowed to disturb — one pin added, one
       *  reordered, or one pinned node retitled in the file it lives in, and
       *  without a key every other row of the shelf was replaced with it. The
       *  sidebar keys the shelf by this same id (`pins/Shelf.tsx`'s
       *  `<Key each={pins()} by="id">`), so a reorder now MOVES the rows it
       *  reorders.
       *
       *  IT IS THE ONE DECLARATION HERE WHOSE FIELD ALSO LIVES OUTSIDE THE ROWS
       *  it was chosen for, and kolu warns about exactly that: a declared key is
       *  identity WHEREVER it appears, so `Pinned.shows` — a nested object that
       *  happens to carry an `id` of its own — is merged in place while that id
       *  reads the same and replaced whole the moment it reads different. Which
       *  is the behaviour this member wants: a row whose address comes to name a
       *  different node should get a fresh answer rather than a field-merged
       *  one. The other three declarations have no such object. */
      arrayKey: "id",
    },
    /**
     * HOW FULL THE INBOX IS — the top-level regular nodes of whichever
     * outline `inboxIn` names that still await processing
     * (`@olai/format`'s {@link InboxHeld}). A done row does not count,
     * and neither does a finished branch.
     *
     * A CELL, and for `pins`' reason: the count is a fact about the
     * directory, not about who is asking or what they are looking at, so
     * there is no input to give a stream and no question to make a
     * procedure of. The server recomputes it on every published revision
     * and sends it when the number moved, which is §2's mechanism sentence
     * exactly.
     *
     * ONE INTEGER and not the file, because which outline the inbox IS is
     * already answered from the paths the tab holds (`inboxIn` over
     * `heads`). Duplicating that path here would be two answers to one
     * question, free to disagree by a frame.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`): an agent asking
     * what the inbox holds asks `list_outlines` and is answered with the
     * nodes. A badge is a paint instruction for a door somebody is looking
     * at.
     */
    inbox: {
      schema: InboxHeld,
      default: NO_INBOX,
      verbs: ["get"],
      equals: sameInboxHeld,
    },

  },
  collections: {
    ...koluMembers.collections,
    /**
     * The served directory, one entry per outline file.
     *
     * `deltas` is what makes it worth being a collection: a (re)subscribe gets
     * the whole keyed set, and a probe tick that touched three files sends ONE
     * coalesced `{upserts, removes}` frame naming those three — so the wire
     * cost is the files that moved rather than the corpus, and a `git pull`
     * that rewrites forty of them is still one frame.
     *
     * Read-only on the wire. There is no `upsert` a browser could call: a
     * change to an outline is a change to a FILE, and the only way to make one
     * is the ops layer, whose writes come back through the probe like every
     * other change on the disk.
     */
    outlines: {
      /** Root-relative, `/`-spelled — `"roadmap.olai"`, `"notes/todo.olai"`.
       *  The same spelling the store's paths and every `file:line` use. */
      keySchema: Schema.String,
      schema: OutlineEntry,
      verbs: ["keys", "get", "deltas"],
    },
    /**
     * Every BODIED file the directory holds, one entry each — see
     * {@link DocumentEntry}.
     *
     * That is every `.md` and every `.html`: the files whose content olai
     * carries verbatim rather than parsing into records (`@olai/format`'s
     * registry says which those are). ONE collection rather than one per kind,
     * because what is encapsulated here is not markdown — it is "a body,
     * fetched per key, by whoever is showing it", and a second collection would
     * be that same arrangement built again for a file that differs only in how
     * a page draws it. The name is kept because it is the wire's: an MCP client
     * already addresses `surface://collections/documents`.
     *
     * `keys` and `get`, and NO `deltas`, and the omission is the whole point.
     * `deltas` opens with a snapshot of every entry, which for this collection
     * is every body: the batched verb that makes `outlines` cheap is the exact
     * shape that made documents expensive. So a reader takes the KEY SET —
     * which is what the sidebar's file tree draws (paths, no titles, no text)
     * — and opens a per-key `get` for the one document it is showing. A
     * directory of a thousand `.md` files costs a thousand PATHS on first
     * paint, and one body per document actually read.
     *
     * Read-only on the wire, like the outlines and for the same reason: a
     * document is a file on the disk, and the ops layer is the only writer.
     */
    documents: {
      /** Root-relative, `/`-spelled — the same spelling `outlines` uses, and
       *  the same spelling `doc` resolves to (`docOf`) and every `file:line`
       *  names. */
      keySchema: Schema.String,
      schema: DocumentEntry,
      verbs: ["keys", "get"],
    },
    /**
     * EVERY SERVED FILE, one HEAD each and no content — see {@link Head}.
     *
     * THE DIRECTORY, as a browser holds it. This is the whole of what a tab
     * knows about the vault since PR 10 of
     * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`: the sidebar's tree is these paths, a page model
     * asks these for membership, the palette draws these titles, and everything
     * else a screen shows comes from that page's own reading (`./page.ts`).
     * `outlines` used to answer the first four of those, by handing every tab
     * every record of every file.
     *
     * `deltas` here, and the omission next door, are the same decision read
     * twice. The batched verb is a push of every entry, which for `documents`
     * is every body and is exactly what that collection exists to stop
     * sending; for this one it is a path, an integer and a face per file, which
     * is what a key set plus a title costs. So the cheap member takes the cheap
     * verb, and a tab watching one file for changes opens no stream of its own:
     * it reads the entry it wants out of the one snapshot-then-delta stream the
     * sidebar's paths already arrive on.
     *
     * IT IS A SUPERSET OF {@link documents}' KEYS, and that direction is what a
     * reader may rely on: the file list comes from HERE, so a head missing for
     * a file the directory holds is a file the sidebar stops listing, and a
     * bodied file's head is always here to open its body against. Every slice
     * is cut in one function, from one binding of one list, through one `keyOf`
     * (`@olai/server`'s `published.ts`, where that is spelled out and asserted)
     * — so breaking it takes an edit rather than a drift.
     *
     * Read-only on the wire, like every other file-shaped member: what a head
     * says is what the disk said.
     */
    heads: {
      /** Root-relative, `/`-spelled — the same spelling every other member
       *  here is keyed by, and the one every `file:line` names. */
      keySchema: Schema.String,
      schema: Head,
      verbs: ["keys", "get", "deltas"],
    },
    /** The conversation. `deltas` is the whole point — see {@link ./chat.ts}:
     *  one subscription carries both the history a late joiner needs and the
     *  frames a live tab is watching. Read-only on the wire: a transcript is
     *  something that HAPPENED, and the only way to add to it is to prompt. */
    transcript: {
      keySchema: Schema.String,
      schema: ChatEntry,
      verbs: ["keys", "get", "deltas"],
    },
    /**
     * THE ROW THAT IS STILL BEING SAID, in pieces — the transcript's second
     * member and the reason a streaming answer costs the wire the answer
     * ({@link ./chat.ts}'s `Saying`, which argues the whole thing).
     *
     * A SECOND MEMBER rather than a second delivery of the first, and the
     * argument is the one the header above makes about events: the two carry
     * different facts. `transcript` carries ROWS, whole, and answers a late
     * joiner with the conversation; this carries the PIECES of the one row
     * still growing, which nobody needs a history of — a reader that missed
     * them has the text in the row. So the expensive promise is kept once, by
     * the member that has to keep it, and the cheap frames are cheap.
     *
     * `deltas` and nothing else. There is no key here anybody looks up: a
     * piece is found by the row it names, off the frames as they arrive, and
     * `keys`/`get` would be two verbs offered to nobody. Read-only on the
     * wire for `transcript`'s reason, one step sharper — this is not even
     * something that happened, it is how something that is happening is
     * being delivered.
     */
    saying: {
      keySchema: Schema.String,
      schema: Saying,
      verbs: ["deltas"],
    },

  },
  /**
   * THE TWO DATE READINGS THE SIDEBAR DRAWS — the shown month's dots, and how
   * much is owed today.
   *
   * STREAMS, and this surface's first: a stream is a CELL WITH AN ARGUMENT.
   * The design doc's mechanism paragraph
   * (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` §2) says what "updates to that" has to mean — "on
   * every published revision the server recomputes each open page's reading and
   * sends it when it changed by value — the surface framework's
   * `equals`-guarded cells already work exactly this way" — and that is
   * precisely a stream's poll shape upstream: read, install a listener, re-read
   * on every tick and emit only when `isEqual` says the answer moved
   * (`@olai/server`'s `runtime.ts` supplies all three).
   *
   * SO WHY NOT CELLS. Because neither reading is a value the server owns. One
   * is about the month a reader PAGED TO, which is chrome state living in the
   * sidebar (`@olai/web`'s `calendar/Calendar.tsx`), and the other is counted
   * against the reader's OWN today, which the server cannot know — the dates in
   * the files are what a person wrote down, so what is late is late where they
   * are standing, and two tabs either side of midnight are owed two different
   * answers. A cell would have to pick one of them and be wrong for the other.
   *
   * AND WHY NOT PROCEDURES, which is what the two search doors are. A search is
   * a question somebody asks once and reads the answer to; these are STANDING
   * views — a date set anywhere in the directory has to light its day and move
   * the count with no reload, which is what the calendar and the agenda's mark
   * have always promised. Asked as procedures they would need a generation to
   * re-ask on, and the only generation a browser has is its own copy of the
   * derivation — the copy this whole design is taking away. A subscription
   * needs no token at all: the server knows when the directory moved.
   *
   * READ-ONLY BY CONSTRUCTION: a stream has one verb (`get`) and no write
   * shape to withhold, which is the right vocabulary for a reading of files
   * that belong to the disk.
   *
   * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), for the reason
   * {@link narrowing} is: an agent asking what is late asks `search_nodes`
   * with a date clause and is answered with the NODES. A month of dots is a
   * paint instruction for a grid, and two integers about today are a badge —
   * neither is an answer anything without a screen can act on.
   */
  streams: {
    ...koluMembers.streams,
    /** Which days of one month have something on them — see `@olai/format`'s
     *  `DatedRequest` / `DatedAnswer`, and the `sameDated` beside them, which
     *  the server binds as this member's `isEqual` and is what keeps a revision
     *  that moved no dot from sending a frame. */
    dated: {
      inputSchema: DatedRequest,
      outputSchema: DatedAnswer,
    },
    /** What is owed as of the reader's own today — `@olai/format`'s
     *  `OwedRequest` and `Owed`, with `sameOwed` beside them. The counts and
     *  not the agenda: what crosses is the two numbers a mark prints, and the
     *  three stretches the PAGE lists arrive on {@link page} below. */
    owed: {
      inputSchema: OwedRequest,
      outputSchema: Owed,
    },
    /**
     * WHAT ONE PAGE SHOWS — the member this whole design was for. See
     * {@link ./page.ts}, which argues the shape, the stream, and what
     * deliberately does not ride here.
     *
     * One subscription per open pane, keyed by the address that pane is
     * drawing: the server computes the reading over the set it already holds
     * and re-sends it whenever a revision changes it by value. What the browser
     * used to do instead was hold every record of every file and answer the
     * same question locally.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), like the two readings
     * above and for their reason: what comes back is a screen — rows with their
     * fold keys, a rollup, the blockers a checkbox draws. An agent asking what
     * an outline holds asks `list_outlines` and `read_subtree`, and is answered
     * in nodes.
     */
    page: {
      inputSchema: PageRequest,
      outputSchema: PageReading,
      /**
       * A ROW IS ITS `key`, and this is the declaration that says so — the one
       * thing `solid-js/store`'s `reconcile` cannot be told anywhere else, and
       * the member where it pays most in this whole spec.
       *
       * Without it a frame REPLACES every element of every array it merges, so
       * a frame that merely repeats what a tab already holds still notifies
       * every reader of every row: `Tree.tsx`'s `<Key each={rows} by="key">`
       * keeps its DOM, but `keyArray` hands every `Branch` a new object, and
       * some twenty-five bindings per row re-run for a one-character change in
       * one row (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md`'s 2.11 — the
       * one finding of that audit with no client-side fix). With it, an
       * identical frame notifies nothing at all, a changed row notifies that
       * row, and a REORDER moves the row objects the keyed view is following
       * rather than rewriting them.
       *
       * `key` and not `id`, and the choice is forced: one field per member,
       * reaching every array at every depth. `@olai/format`'s `Row.key` is a
       * required, non-nullable string and the identity a place is drawn under
       * (the chain of ids from the page's roots — the same key the fold, the
       * editor's `refound` and every `<Key>` in the tree already follow), where
       * `id` names the NODE and a mirror draws one node in two places. The
       * arrays whose elements carry no `key` — `names`, the crumb trail,
       * `backlinks`, `referrers`, a day's groups — merge BY POSITION, which is
       * the declared reach of this key rather than a fallback around it, and
       * which is silent on a repeated frame just the same. Their consumers all
       * key by VALUE (`<Key by="id">`, `by={placeOf}`, `by="file"`), so
       * position is exactly the right amount of identity to give them.
       */
      arrayKey: "key",
    },
    /**
     * WHICH OF THAT PAGE'S NODES THE QUERY SELECTS — the filter box's answer,
     * beside the page it narrows. See {@link ./narrowing.ts}, which argues the
     * shape, why it is a stream, and why it is a stream of its own.
     *
     * One subscription per narrowed pane, keyed by the address AND the words:
     * the server matches over the records that page draws and re-sends only
     * when a revision moved which of them match. What this replaced was
     * `search.matching`, a whole-vault walk asked once per page frame.
     *
     * NO `arrayKey`: what travels is `{id, matched?}` rows with no identity of
     * their own beyond the id, and they merge BY POSITION, which is what the
     * declaration's absence means rather than a fallback around it. The whole
     * answer is rebuilt into a `Map` by its one reader, and an identical frame
     * is silent either way ({@link page}'s own paragraph on the arrays that
     * carry no key).
     */
    narrowing: {
      inputSchema: NarrowingRequest,
      outputSchema: NarrowingAnswer,
    },
    /**
     * WHETHER A ROW CAN GO WHERE SOMEBODY IS POINTING — the move-to picker's
     * preview of the planner's verdict, for the destinations its search just
     * offered ({@link ./page.ts}'s closing paragraph).
     *
     * A STREAM beside {@link page} rather than a procedure, for the reason that
     * one is: the panel stands open while anybody writes, and what it judges
     * has to be where the row has actually got to.
     *
     * THE BROWSER'S ALONE, like {@link narrowing} next door and for the same
     * reason: what comes back is a dim and a sentence for a list of rows on a
     * screen. An agent moving a node asks `move_node` and is refused by the
     * planner, in the planner's own words.
     */
    moving: {
      inputSchema: MovingRequest,
      outputSchema: MovingAnswer,
    },
  },
  procedures: {
    ...koluMembers.procedures,
    chat: {
      /** Prompt the agent. Answers as soon as the turn is ACCEPTED, not when
       *  it ends: what the panel draws comes back on the transcript, so every
       *  open tab stays in step and a slow turn does not hold a call open. */
      send: {
        input: Schema.Struct({
          text: Schema.String,
          /**
           * INTERRUPT the turn the agent is already running with this, rather
           * than taking a place behind it.
           *
           * The one deliberate gesture, and it is a field on `send` rather than
           * a verb of its own because it is the SAME message either way: the
           * row is written, the words go out, and what differs is which turn
           * hears them. Two procedures would be two places to keep the
           * attachment claim, the node resolution and the row in step.
           *
           * Absent is the default and the default is to WAIT — plain enter
           * takes a place in the agent's own queue, which is what makes an
           * interruption something somebody chose. It costs nothing on an idle
           * agent (there is no turn to interrupt, and the message starts one
           * either way) and nothing on an agent that cannot be interrupted (it
           * is sent as the ordinary prompt it would have been), so a stale tab
           * that sends it cannot lose anybody's words.
           */
          steer: Schema.optionalKey(Schema.Boolean),
          /** The pictures this message carries, as the PATHS `attach`
           *  answered with. Absent is the same as empty — a prompt with no
           *  picture is every prompt olai had until now, and a caller should
           *  not have to spell an empty list to say so.
           *
           *  Paths and not bytes, because that is the whole design: the file
           *  is already on disk by the time this is called, the agent is
           *  handed the path in its prompt and reads it itself. They are
           *  re-checked against the conversation's own directory here — a
           *  path that arrived over the wire names nothing on its own. */
          attachments: Schema.optionalKey(Schema.Array(Schema.String)),
          /** The nodes this message is ABOUT, by ID — what "ask agent" on a
           *  row armed the composer with.
           *
           *  IDS AND NOTHING ELSE, which is the decision worth naming: a
           *  browser drew a row from a frame that is already some
           *  milliseconds old, so a title or a `file:line` it sent would be
           *  its account of the set rather than the set's. The id is the one
           *  thing it can say that the server can resolve — and resolving it
           *  is what the server does, against the same reading a keystroke's
           *  write is judged against, so what reaches the agent is the node
           *  as it IS. An id nothing declares refuses the send: the message
           *  was about that node, and sending it without one would be asking
           *  the agent to guess which. */
          context: Schema.optionalKey(Schema.Array(Schema.String)),
        }),
        error: ChatFailure,
      },
      /**
       * Try a message the agent would not take AGAIN — `id` is the `user`
       * row's own key, the one carrying `delivery: "refused"`.
       *
       * The row is the only copy of those words, so retrying from it is the
       * only retry that can be whole: the server still holds the prompt it
       * failed to deliver, pictures and node lines and all, where a browser
       * re-reading the row would have the names of the pictures and not their
       * paths. What lands is the same message, not a reconstruction of it.
       *
       * A person's click and nothing else drains this. Nothing retries on its
       * own, which is the difference between a row that says it did not go and
       * the queue this replaced: an undelivered message stays on screen, in the
       * conversation, until somebody decides what to do with it.
       *
       * It REFUSES for a row whose delivery went `unanswered`: the server kept
       * no prompt for one, because an agent that went quiet may have the
       * message already and a second copy is the one outcome this must not be
       * able to produce.
       */
      resend: {
        input: Schema.Struct({ id: Schema.String }),
        error: ChatFailure,
      },
      /** One chunk of a picture, into the conversation's tmp directory.
       *
       *  A PROCEDURE rather than an upload route, which is the decision worth
       *  naming: a procedure inherits the origin gate and the session the
       *  listener already enforces for the websocket, where a second HTTP
       *  route would need its own copy of both. And a SIBLING of `send`
       *  rather than a widening of it, because the two answer different
       *  questions — `attach` says where the bytes landed, `send` says a turn
       *  was accepted — and a file is N calls to one send. */
      attach: {
        input: AttachChunk,
        output: Attached,
        error: ChatFailure,
      },
      /** Stop the turn in flight. Legal while the agent is still booting — the
       *  cancel is remembered and sent with the prompt. */
      cancel: { error: ChatFailure },
      /** Start a fresh conversation WITH the named agent — one of
       *  {@link ChatState.roster}'s ids. The agent-side context goes away and
       *  the transcript is emptied.
       *
       *  The agent is REQUIRED, and that is the ruling rather than an
       *  ergonomic: every new chat asks which one, and no default is
       *  remembered across conversations. A verb that could be called without
       *  one would be the place a default grew back. Refuses an id this machine
       *  does not have, which is what a tab open across a restart can send. */
      newSession: {
        input: Schema.Struct({ agent: Schema.String }),
        error: ChatFailure,
      },
      /** Answer the question the panel is asking ({@link ChatState.talking}'s
       *  `asking` arm):
       *  THIS agent, now open the conversation you would have opened.
       *
       *  Not {@link newSession} with the same argument. A boot that stopped to
       *  ask has not asked for a new conversation — it was stopped before it
       *  could come back to the one this directory was in — so this opens that
       *  agent's remembered conversation, or its most recent, and only mints a
       *  fresh one where it has none. `+ new` is the verb that always means
       *  fresh. */
      chooseAgent: {
        input: Schema.Struct({ agent: Schema.String }),
        error: ChatFailure,
      },
      /** Move to one of the stored conversations. The transcript is replaced by
       *  the replay, because a transcript of a session you are not in is a lie.
       *
       *  WITH the agent whose conversation it is, which the row itself carries
       *  ({@link SessionInfo}). The list spans every installed agent now, so a
       *  row picked out of it may belong to the one this panel is NOT talking
       *  to — and opening it is a change of agent as well as of conversation,
       *  exactly the change {@link newSession} makes. A session id means
       *  nothing to the wrong agent, so this is not a detail the server could
       *  work out from the id. Refuses an agent this machine does not have. */
      loadSession: {
        input: Schema.Struct({ agent: Schema.String, id: Schema.String }),
        error: ChatFailure,
      },
      /** Try the OPEN that was refused again — the one the panel is holding a
       *  {@link ChatState.unopened} for, whichever it was.
       *
       *  It takes no argument, and that is the point rather than an omission: a
       *  boot chooses its own conversation, so a browser naming one would be
       *  asking for something nobody asked for. The server kept the attempt,
       *  the way it keeps the prompt behind an undelivered message. Refuses
       *  when there is nothing waiting to be opened again. */
      reopen: { error: ChatFailure },
      /** EVERY installed agent's stored conversations for this directory,
       *  merged newest-first, each row saying whose it is.
       *
       *  The one this panel is talking to is asked every time, because its list
       *  is the only one that is right and it is already running. The others
       *  are asked when their answer is stale ({@link ../../chat/src/listings.ts}),
       *  one at a time — opening a list is not a reason to start three
       *  subprocesses at once. */
      sessions: {
        output: Listed,
        error: ChatFailure,
      },
      /** Answer a question the agent asked — the `ask` entry named by `id`,
       *  filled in. The turn is blocked until this or {@link decline} arrives,
       *  which is why both are verbs rather than a write to the transcript. */
      answer: {
        input: Schema.Struct({
          id: Schema.String,
          answers: Schema.Array(AskAnswer),
        }),
        error: ChatFailure,
      },
      /** Dismiss one, honestly: the agent is told a person declined to answer,
       *  and never handed an answer nobody gave. */
      decline: {
        input: Schema.Struct({ id: Schema.String }),
        error: ChatFailure,
      },
    },
    /** What a KEYBOARD may do — one procedure over the browser's own closed
     *  union of edits, each landing as one op through the same write gate the
     *  agent's tools go through. Declared next door in {@link ./edit.ts},
     *  which says why the verbs are intents rather than the ops requests
     *  re-spelled, and why they are one member rather than five. */
    edit: editProcedures,
    /** What an AGENT may do — the ops request vocabulary itself, declared in
     *  {@link ./ops.ts}. The other half of the sentence above: a keyboard sends
     *  intents and an agent names ops, and the two are deliberately different
     *  vocabularies over one write gate.
     *
     *  REACHABLE FROM NO BROWSER, and that is a property of how each face is
     *  served rather than of this declaration — `@olai/server`'s `faces.ts`
     *  holds the per-face maps, and a tab that calls one of these is refused
     *  with `SurfaceMemberNotExposed`. Until juspay/kolu#2170 that could not be
     *  said, which is why these verbs were not here. */
    ops: opsProcedures,
    /** THE DOOR onto the one matcher for a caller that wants a LIST — the
     *  palette's search, the same reading `search_nodes` answers an agent with,
     *  reached as a question rather than re-implemented over nodes the browser
     *  no longer holds. See {@link ./search.ts} for why that restraint is the
     *  point. The other caller of that matcher is a PAGE, and it is not here:
     *  narrowing one is a reading of a page rather than a call, and it rides
     *  the revision pulse as a stream ({@link ./narrowing.ts}). */
    search: {
      nodes: {
        input: SearchRequest,
        output: SearchAnswer,
        error: OpFailure,
      },
    },
    /**
     * THE IDS AN AGENT WROTE IN BACKTICKS, looked up — which of them the set
     * declares, and what each one names.
     *
     * ITS OWN NAMESPACE rather than a third member of {@link search}, because
     * it is not a search: nothing here reads the filter grammar, ranks anything
     * or decides what a word means. It asks about ids EXACTLY, which is the
     * lookup an edge target and a `see` link already are (`@olai/format`'s
     * `nodeNamed`) — spelled for a dozen at once, because the caller is one
     * message of a transcript and a message holds every backtick the agent put
     * in it.
     *
     * A BATCH is the whole shape: a `read_node` per span would be a dozen round
     * trips carrying a dozen nodes in full to decide which two words in a
     * paragraph are pressable.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), for the reason the
     * member above is: an agent asking whether an id is real asks `read_node`
     * and is told everything about it. What comes back here is a node id per
     * span, which is useful only to a caller already looking at the words those
     * ids are written in.
     */
    nodes: {
      named: {
        input: NamedRequest,
        output: NamedAnswer,
        error: OpFailure,
      },
      /**
       * WHERE THE IDS A READER REMEMBERS NOW LIVE — and whether the set has
       * anything at all from the files they were last seen in.
       *
       * A SECOND MEMBER of this namespace rather than a field on the first,
       * because the two ask different questions of different tables. {@link
       * named} FOLLOWS a mirror chain: a backtick in an agent's prose means the
       * node a reader would be shown. This one is the plain record lookup, no
       * chain walked, because its caller remembers RECORDS — a mirror whose
       * chain has died shows nothing and is folded by its own id, and asked
       * through `named` it would read as a node that is gone while its record
       * sits in the file.
       *
       * THE CALLER is the browser's fold memory (`@olai/web`'s
       * `fold/memory.ts`): collapsed node ids, grouped by the file each node
       * is defined in, kept across reloads. Keeping that honest as the
       * directory moves is three rules — a node that was ARCHIVED is the same
       * node in another file and keeps its fold, a node somebody DELETED should
       * stop being remembered, and a file that stopped parsing says NOTHING
       * about its nodes — and answering all three used to mean walking the whole
       * id→file map of the tab's own copy of the set, per fold. The rules did
       * not move; the map did.
       *
       * TWO LISTS IN, TWO OUT, and no pairing between them
       * (`@olai/format`'s `HomesRequest` argues it): which id was filed under
       * which file is the caller's own bookkeeping, and this end holds no
       * opinion about a browser's storage. They travel together because they
       * are READ together — an id's absence means "deleted" only beside the
       * fact that its file was read at all — and not because the second half is
       * a secret: which files are served, and which would not parse, are on the
       * wire already. What one answer buys is that the halves cannot be about
       * two different revisions.
       *
       * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), for the reason
       * every member around it is: an agent that wants to know where a node
       * lives reads it and is told, beside everything else about it. What comes
       * back here is a path per id, useful only to somebody reconciling a
       * memory of their own.
       */
      homes: {
        input: HomesRequest,
        output: HomesAnswer,
        error: OpFailure,
      },
    },
    /**
     * THE SET'S OWN WORDS, as opposed to a question about them.
     *
     * A sibling of {@link search} rather than a third member of it, because
     * nothing in here reads the query grammar: this answers which tags have
     * been WRITTEN DOWN and how much each is used, where every member of that
     * group is a caller of the one matcher. Two doors with two subjects, said
     * in the shape rather than in a comment on a shared one — and the same
     * division {@link nodes} above makes for a lookup that is not a search
     * either.
     *
     * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), like the filter's
     * door: what it answers is a popup's worth of rows, capped by the popup.
     */
    vocabulary: {
      /** The row editor's `#`/`@` completion — the vocabulary of one sigil,
       *  narrowed by what has been typed after it, most-used first. Declared in
       *  `@olai/format`'s `vocabulary.ts` beside the reading that produces it,
       *  for {@link ./search.ts}'s reason: one spelling, so the shape cannot
       *  drift from the answer. */
      tags: {
        input: TagsRequest,
        output: TagsAnswer,
        error: OpFailure,
      },
    },
    /**
     * The other door to the same action the agent's `commit` tool opens.
     *
     * A PROCEDURE rather than a write verb on the cell above: committing is
     * not "set pending to something", it is an act with four possible answers,
     * and three of them are refusals a reader has to be shown. What it changes
     * is `pending`, which the server republishes the moment it is done.
     */
    git: {
      commit: {
        input: CommitRequest,
        output: CommitResult,
        error: OpFailure,
      },
      /**
       * The other verb, and the one the human said was the last reason to leave
       * olai for a terminal.
       *
       * No input at all, which is the design rather than an omission: the
       * current branch to the upstream it already has, and nothing to choose.
       * What it changes is `pending` — the unpushed count both the panel and the
       * header draw — which the server republishes the moment it is done, for
       * the same reason a commit does.
       */
      push: {
        input: Schema.Struct({}),
        output: PushResult,
        error: OpFailure,
      },
      /**
       * WHAT THIS DIRECTORY'S GIT POLICY IS TO BE — the two preference rows'
       * door, and the whole of `git-policy-server-side` on the write side.
       *
       * The rows used to be preferences of one BROWSER, stored there and sent
       * nowhere, so two people looking at one directory could each believe
       * something different about it and only one of them could be right.
       * Whether a branch is pushed is not a claim about a reader. So the rows
       * set the SERVER's policy, it is remembered outside the vault, and every
       * tab draws the same answer off the `git` cell.
       *
       * Each half is optional, because the rows move one at a time. A half the
       * operator PINNED refuses rather than quietly doing nothing: a
       * read-only control that could be bypassed by a procedure would be the
       * pin honoured in the drawing and not in the doing.
       *
       * What it changes is the `git` cell, which the server republishes the
       * moment it is done — including to the tab that asked, so nothing here
       * has to echo the new value into a signal of its own.
       */
      setPolicy: {
        input: PolicyRequest,
        // NOTHING COMES BACK, and that is the feature rather than an omission:
        // what changed is the cell, and a returned policy is exactly the second
        // opinion this move exists to retire — the next client to echo it into
        // a signal of its own would have per-tab divergence again, and it would
        // look like it was designed for.
        output: Schema.Struct({}),
        error: OpFailure,
      },
      /**
       * Start the quiet-window loop again after git stopped it.
       *
       * A PROCEDURE rather than a side effect of some other gesture, and that
       * is what moving the pause to the server costs and buys: the stop is a
       * fact about the directory, so turning a toggle off and on in one browser
       * cannot be what clears it, and a Resume pressed in one tab clears it in
       * every other one.
       */
      resume: {
        input: Schema.Struct({}),
        // ... and nothing comes back from this one either. What a person needs
        // to see is that the loop is running again, which is the chip going
        // from `paused` to `armed` on the same republish — in this tab and in
        // every other one, which a return value could never have done.
        output: Schema.Struct({}),
        error: OpFailure,
      },
    },
    /**
     * WHO IS LOOKING on this connection — the login a reverse proxy stamped
     * on the upgrade, already resolved down the picture ladder.
     *
     * A PROCEDURE, not a cell: a cell is one value for the process, and this
     * value is one value for THIS TAB. The login is stamped at the upgrade
     * and does not move for the life of the socket, so there is nothing to
     * subscribe to. `GET /olai/who` stays for the plain-HTTP doors (a share
     * sheet, a script); a tab that is already connected reads this instead.
     *
     * THE BROWSER'S ALONE: an agent has no login header on its face, and
     * asking who is looking at a tab is a paint instruction for a chip.
     */
    who: {
      get: {
        output: Schema.NullOr(Who),
      },
    },
    /**
     * WHAT THIS DEPLOYMENT IS CALLED — the machine the server runs on, so the
     * app can name itself `olai [machine]` everywhere it names itself
     * (`./app.ts` says why, and what draws it).
     *
     * THE SAME SHAPE as `who.get` — one ask, asked once: a process constant
     * is nothing to subscribe to, so it is a procedure and not a cell. And
     * THE BROWSER'S ALONE, also for `who.get`'s reason: an agent acts on the
     * vault, not on the chrome; the box's name is a paint instruction the
     * manifest, the wordmark and the tab draw.
     */
    app: {
      get: {
        output: App,
      },
    },
  },
})

export {
  AGENTS,
  AgentChoice,
  AgentEntry,
  type AgentId,
  agentIn,
  Armed,
  Ask,
  AskAnswer,
  AskChoice,
  AskEntry,
  AskField,
  AskOutcome,
  Attached,
  AttachChunk,
  BusyFailure,
  CHAT_OFF,
  ChatEntry,
  ChatFailure,
  ChatServer,
  ChatState,
  Command,
  Delivery,
  FileDiff,
  isAgentOut,
  isOpFailure,
  isRunningStatus,
  isStillRunning,
  isTaskOut,
  kindOf,
  NodeContext,
  NoticeEntry,
  OpFailure,
  outSince,
  RefusalEntry,
  Conversation,
  Listed,
  sameStanding,
  sentToDo,
  Saying,
  sayingEnd,
  sayingKey,
  SAYING_MS,
  ServerStanding,
  SessionInfo,
  Spawned,
  Talking,
  ToolEntry,
  ToolStatus,
  Unopened,
  Unreachable,
  Usage,
  UsageFailure,
  UserEntry,
  Watched,
  Watching,
  whyNot,
  Wrote,
  YES_NO,
} from "./chat.ts"

/** What a keyboard may do — one tagged union, and what a write that landed
 *  says. See {@link ./edit.ts}. The union is what makes the server's mapping
 *  onto ops requests total. */
export { type Applied, Anchor, Edit } from "./edit.ts"

/** What a reader meant by a press — one rule, because the app answers a click
 *  in three places and the seal ships a fourth into somebody else's page. See
 *  {@link ./press.ts}. */
export { ours, type Press } from "./press.ts"

/** The one HTTP address both ends spell — see {@link ./media.ts}. `mediaTarget`
 *  is what the ROUTE may answer, and it is the only half either end needs: the
 *  decoder under it (`mediaPath`, which admits files the route refuses) stays
 *  inside this package, where its one caller is, because an export of it is a
 *  way to ask the traversal guard a question and ignore the allowlist. */
export { MEDIA_PREFIX, mediaHref, mediaTarget } from "./media.ts"

/** Who is looking — the HTTP door both ends still spell, and the JSON the
 *  `who.get` procedure carries. See {@link ./who.ts}. */
export { WHO_PATH, Who } from "./who.ts"

/** What this deployment is called, and when this process started — the two
 *  facts `app.get` carries, and the one spelling every face of the app names
 *  itself with. See {@link ./app.ts}. */
export { App, appName } from "./app.ts"

/** Where the hashed browser bundle lives, and what the bundler names a split
 *  chunk in it — see {@link ./bundle.ts}. One spelling, both halves of the
 *  serve, and the two suites that hold a chunk up. */
export { ASSET_PREFIX, chunkFile, chunkUrl } from "./bundle.ts"

/** What a served `.html` is answered with, how tall it says it is, and which
 *  page of this vault it says a reader clicked — the other contract between the
 *  server that writes it and the browser that reads it, for {@link ./media.ts}'s
 *  reason. See {@link ./seal.ts}. */
export {
  BODY_REFUSED,
  heard,
  REFUSED_MARKUP,
  ROUNDING,
  type Said,
  SEAL,
  sealPolicy,
  spellsHost,
} from "./seal.ts"

/** WHICH IDS THE SET DECLARES, and what each names — the transcript's batch
 *  lookup. `@olai/format`'s own shapes, re-exported rather than re-declared,
 *  exactly as the search shapes below are and for the same reason: this package
 *  is a spec, and the read vocabulary is the floor's. */
export { NamedAnswer, NamedRequest } from "@olai/format"

/** WHERE THE IDS A READER REMEMBERS NOW LIVE, and which of the files they were
 *  filed under this directory has actually read — the fold memory's batch,
 *  whose shapes are the floor's for the reason above. */
export { HomesAnswer, HomesRequest } from "@olai/format"

/** THE PINNED SHELF as the `pins` cell carries it — the floor's shapes again,
 *  re-exported for the same reason, so the sidebar draws the rows the reading
 *  produced rather than a second description of them. `sameShelf` does NOT come
 *  through this door: a cell declares its `equals` in the spec above, which is
 *  the only place that answer is spent (`samePending` is imported here and
 *  re-exported by nobody, for the same reason). */
export { NO_PINS, Shelf } from "@olai/format"
export type { Pinned } from "@olai/format"

/** HOW FULL THE INBOX IS as the `inbox` cell carries it — the floor's
 *  shape, re-exported for the shelf's reason. `sameInboxHeld` does NOT
 *  come through this door: a cell declares its `equals` in the spec. */
export { InboxHeld, NO_INBOX } from "@olai/format"

/** What the sidebar's two date readings ask and answer on the wire — see
 *  {@link ./dates.ts}. */
export { DatedAnswer, DatedRequest, Owed, OwedRequest } from "./dates.ts"

/** What a PAGE asks and answers, and what the move picker does — see
 *  {@link ./page.ts}. */
export { MovingAnswer, MovingRequest, PageReading, PageRequest } from "./page.ts"

/** What a PAGE'S FILTER asks and answers — see {@link ./narrowing.ts}. */
export { NarrowingAnswer, NarrowingRequest } from "./narrowing.ts"

/** What a search asks and answers on the wire — see {@link ./search.ts}. */
export {
  DocumentHit,
  isNodeHit,
  MatchedNode,
  NodeHit,
  Refusal,
  SearchAnswer,
  SearchHit,
  SearchRequest,
} from "./search.ts"

/** What a tag COMPLETION asks and answers — `@olai/format`'s declarations,
 *  carried rather than re-spelled, for {@link ./search.ts}'s reason. The
 *  browser sends a sigil, a prefix and the number of rows its popup has; the
 *  answer is the words this set already uses, most-used first. The reading
 *  behind it is that package's `vocabulary.ts`, which is where it moved when
 *  the browser stopped holding a vault to enumerate. */
export { TagCompletion, TagsAnswer, TagsRequest } from "@olai/format"

/** What an attachment may BE — the policy the browser gates on before encoding
 *  and the server gates on before writing. One module, for the same reason the
 *  media URL is one: two copies of a threshold are two thresholds. How it is
 *  cut UP is not here and is not re-exported: that is
 *  `@kolu/surface/frame-chunking`, which both ends import directly. See
 *  {@link ./attach.ts}. */
export {
  ATTACHMENT_EXTENSIONS,
  attachmentRejection,
  DOCUMENT_EXTENSIONS,
  isAttachable,
  MAX_ATTACHMENT_BYTES,
} from "./attach.ts"

/** THE KOLU HALF — the padi link, the fleet it mirrors, the pane's frames and
 *  the one snapshot read a chip makes.
 *
 *  RE-EXPORTED FROM `@olai/kolu-client/wire`, which is where these shapes live
 *  now: the sixth sitting ruled everything kolu-named out of the non-kolu
 *  packages, spec included, and this is the one package the browser always
 *  bundles. The re-export is the whole reason no consumer had to rewrite an
 *  import — the composed spec still answers for its own members, which is what
 *  a composed spec is for. */
export {
  FleetOwner,
  FleetTerminal,
  KoluEvent,
  KOLU_UNDIALED,
  KOLU_UNPULSED,
  KoluLink,
  KoluMutes,
  KoluStatus,
  NO_MUTES,
  type Resolved,
  resolveTerminal,
  sameKolu,
  sameMutes,
  Snapshot,
  SnapshotRefused,
  SnapshotRequest,
  TerminalAttach,
  TerminalFrame,
  TERMINAL_KEY,
  UNOWNED,
  type WatchPulse,
} from "@olai/kolu-client/wire"
