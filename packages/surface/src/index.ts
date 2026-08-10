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
 *   - `manifest` is a CELL: the set-wide facts that belong to no one file, and
 *     the answer to "is there a set at all". Its `null` is the state a
 *     collection cannot express — an empty snapshot means "this directory has
 *     no outlines", and a first probe still running has to say something else.
 *   - `errors` is a CELL, read-only on the wire, because "what is wrong right
 *     now" is one value the server does own. It is deliberately independent of
 *     the entries: a set that stops validating leaves the last good tree on
 *     screen underneath a banner, which is only expressible if the two arrive
 *     separately.
 *
 * Who is on the other end is NOT a member here, and it was for one commit. The
 * question is real — a page bound to a replaced server must know — but the
 * framework reserves `system/identity` for it and answers it out of every
 * surface, process id included, so an app that declares its own is declaring a
 * second answer to a question already answered (juspay/kolu#2133).
 *
 * Three more are the chat, and they are declared next door in
 * {@link ./chat.ts} because they are a subject of their own: a `transcript`
 * COLLECTION (batched deltas, so a late-joining tab sees the conversation), a
 * `chat` CELL (session, model, commands, whether a turn is running) and the
 * `chat` PROCEDURES (send, cancel, new, load, list). The agent's WRITES do not
 * appear here at all: they reach the ops layer through an internal MCP server
 * the session is handed, and what a reader sees of them is the outline stream
 * moving — server-authoritative, never an optimistic echo.
 */

import { BrokenFile, Document, Located, OutlineError } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

import {
  CHAT_OFF,
  ChatEntry,
  ChatFailure,
  ChatState,
  SessionInfo,
} from "./chat.ts"

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
 * The set-wide facts, or `null` for a set that has never loaded.
 *
 * `null` is a state, not an absence, and it is the one thing the collection
 * cannot say. Three things a reader must tell apart — "the server has not
 * answered yet" (no frame at all), "the server has never had a valid set to
 * show" (`null`), "here is your directory" (a value) — and an empty collection
 * snapshot is the SECOND and THIRD at once unless something else carries the
 * bit. This is that something.
 *
 * `documents` is here rather than in the collection because a document is not
 * an outline: nothing keys off it, no entry of the collection is one, and the
 * sidebar's second list is a fact about the SET. They carry their text, as they
 * always have — markdown is interpreted at view time and a `doc` reference is
 * drawn wherever its node is, so a paths-only list would need a second read
 * path the app does not have. That is the honest cost of leaving them here:
 * every document's text rides every revision, exactly as it did when the whole
 * set did. Making them a collection of their own is the obvious next step and
 * is deliberately not this change.
 */
export const Manifest = Schema.NullOr(
  Schema.Struct({
    /** The store revision these facts are. Every entry published in the same
     *  tick carries it too; entries that did not move carry an older one. */
    rev: Schema.Int,
    documents: Schema.Array(Document),
  }),
)
export type Manifest = typeof Manifest.Type

export const surface = defineSurface({
  cells: {
    // Wire-read-only: the server is the only writer, and a write verb it never
    // serves would crash surface's boot walk.
    errors: {
      schema: Schema.Array(OutlineError),
      default: [],
      verbs: ["get"],
    },
    /** What is true of the SET rather than of any one file — see
     *  {@link Manifest}. Wire-read-only for the same reason the entries are:
     *  the directory is the disk's. */
    manifest: {
      schema: Manifest,
      default: null,
      verbs: ["get"],
    },
    chat: {
      schema: ChatState,
      default: CHAT_OFF,
      verbs: ["get"],
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
      /** Root-relative, `/`-spelled — `"roadmap.jsonl"`, `"notes/todo.jsonl"`.
       *  The same spelling the store's paths and every `file:line` use. */
      keySchema: Schema.String,
      schema: OutlineEntry,
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
  },
  procedures: {
    chat: {
      /** Prompt the agent. Answers as soon as the turn is ACCEPTED, not when
       *  it ends: what the panel draws comes back on the transcript, so every
       *  open tab stays in step and a slow turn does not hold a call open. */
      send: {
        input: Schema.Struct({ text: Schema.String }),
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
    },
  },
})

export {
  BusyFailure,
  CHAT_OFF,
  ChatEntry,
  ChatFailure,
  ChatState,
  Command,
  isOpFailure,
  kindOf,
  OpFailure,
  SessionInfo,
  Unfinished,
} from "./chat.ts"

/** The one HTTP address both ends spell — see {@link ./media.ts}. */
export { MEDIA_PREFIX, mediaHref, mediaTarget } from "./media.ts"
