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
 *   - `documents` is a COLLECTION keyed the same way, one entry per BODIED file
 *     — every `.md` and every `.html` — and it is subscribed KEYS-FIRST: the sidebar draws paths, so the key set is
 *     the whole of what a first paint needs, and a body travels when a document
 *     is opened (the per-key `get`). No `deltas` — the batched verb is a push
 *     of every entry, which for documents is every body, which is the thing
 *     this collection exists to stop sending.
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
 *
 * Who is on the other end is NOT a member here, and it was for one commit. The
 * question is real — a page bound to a replaced server must know — but the
 * framework reserves `system/identity` for it and answers it out of every
 * surface, process id included, so an app that declares its own is declaring a
 * second answer to a question already answered (juspay/kolu#2133).
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
  GIT_OFF,
  GitState,
  Located,
  NOTHING_PENDING,
  OutlineError,
  Pending,
  PushResult,
  samePending,
} from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

import {
  AskAnswer,
  AttachChunk,
  Attached,
  CHAT_OFF,
  ChatEntry,
  ChatFailure,
  ChatState,
  OpFailure,
  SessionInfo,
} from "./chat.ts"
import { editProcedures } from "./edit.ts"
import { opsProcedures } from "./ops.ts"
import { SearchAnswer, SearchRequest } from "./search.ts"

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
 * `docs/brainstorming/outlines-as-collection.md`. Only the files that MOVED in
 * a tick are upserted, so an unchanged neighbour keeps the older number until
 * something changes it.
 */
export const OutlineEntry = Schema.Struct({
  rev: Schema.Int,
  /** This file's nodes only, in file order. Empty for a file that did not
   *  parse, and empty for one that holds nothing — the difference is `broken`. */
  nodes: Schema.Array(Located),
  broken: Schema.NullOr(BrokenFile),
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
   */
  text: Schema.NullOr(Schema.String),
})
export type DocumentEntry = typeof DocumentEntry.Type

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
export { GIT_OFF, GitState }

/** When two answers are the same answer, so the cell can stay quiet. There is
 *  exactly one thing this value can say, so there is exactly one thing that can
 *  change about it: whether there is a set. */
const sameSet = (a: Manifest, b: Manifest): boolean => (a === null) === (b === null)

export const surface = defineSurface({
  cells: {
    // Wire-read-only: the server is the only writer, and a write verb it never
    // serves would crash surface's boot walk.
    errors: {
      schema: Schema.Array(OutlineError),
      default: [],
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
    },
    /** What git is doing for this directory — see {@link GitState}. Wire-read-only:
     *  it is the server's reading of somebody's working tree, and nothing a
     *  browser could set. Derived from the same survey {@link pending} is, so
     *  the one control that reads both cannot contradict itself. */
    git: {
      schema: GitState,
      default: GIT_OFF,
      verbs: ["get"],
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
    },
  },
  collections: {
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
    /** The conversation. `deltas` is the whole point — see {@link ./chat.ts}:
     *  one subscription carries both the history a late joiner needs and the
     *  frames a live tab is watching. Read-only on the wire: a transcript is
     *  something that HAPPENED, and the only way to add to it is to prompt. */
    transcript: {
      keySchema: Schema.String,
      schema: ChatEntry,
      verbs: ["keys", "get", "deltas"],
    },
  },
  procedures: {
    chat: {
      /** Prompt the agent. Answers as soon as the turn is ACCEPTED, not when
       *  it ends: what the panel draws comes back on the transcript, so every
       *  open tab stays in step and a slow turn does not hold a call open. */
      send: {
        input: Schema.Struct({
          text: Schema.String,
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
       * row's own key, the one carrying `unsent`.
       *
       * The row is the only copy of those words, so retrying from it is the
       * only retry that can be whole: the server still holds the prompt it
       * failed to deliver, pictures and node lines and all, where a browser
       * re-reading the row would have the names of the pictures and not their
       * paths. What lands is the same message, not a reconstruction of it.
       *
       * A person's click and nothing else drains this. Nothing retries on its
       * own, which is the difference between a row marked unsent and the queue
       * this replaced: an undelivered message stays on screen, in the
       * conversation, until somebody decides what to do with it.
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
      /** Start a fresh conversation. The agent-side context goes away and the
       *  transcript is emptied. */
      newSession: { error: ChatFailure },
      /** Move to one of the stored conversations. The transcript is replaced by
       *  the replay, because a transcript of a session you are not in is a lie. */
      loadSession: {
        input: Schema.Struct({ id: Schema.String }),
        error: ChatFailure,
      },
      /** The agent's stored conversations for this directory, newest first.
       *  Asked of the agent every time: its list is the only one that is
       *  right. */
      sessions: {
        output: Schema.Array(SessionInfo),
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
    /** The palette's search — the same reading `search_nodes` answers an
     *  agent with, reached as a question rather than re-implemented over the
     *  nodes the browser already holds. See {@link ./search.ts} for why that
     *  restraint is the point. */
    search: {
      nodes: {
        input: SearchRequest,
        output: SearchAnswer,
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
    },
  },
})

export {
  Ask,
  AskAnswer,
  AskChoice,
  AskField,
  AskOutcome,
  Attached,
  AttachChunk,
  BusyFailure,
  CHAT_OFF,
  ChatEntry,
  ChatFailure,
  ChatState,
  Command,
  FileDiff,
  isOpFailure,
  kindOf,
  MissingServer,
  NodeContext,
  OpFailure,
  SessionInfo,
  Spawned,
  Usage,
  UsageFailure,
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

/** What a served `.html` is answered with, how tall it says it is, and which
 *  page of this vault it says a reader clicked — the other contract between the
 *  server that writes it and the browser that reads it, for {@link ./media.ts}'s
 *  reason. See {@link ./seal.ts}. */
export {
  heard,
  type Reading,
  type Said,
  SEAL,
  sealPolicy,
  spellsHost,
} from "./seal.ts"

/** What a search asks and answers on the wire — see {@link ./search.ts}. */
export { Refusal, SearchAnswer, SearchHit, SearchRequest } from "./search.ts"

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
