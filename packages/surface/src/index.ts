/**
 * @olai/surface — the typed reactive layer, declared once for both ends.
 *
 * The server implements this and the browser subscribes to it; neither writes
 * a line of wire code. That is the rule carried over from the htmx era: no raw
 * sockets, no hand-rolled routes, no message envelopes — the only protocol is
 * this spec, and both sides are type errors away from disagreeing about it.
 *
 * Two members are the outline, which is the whole of "see your outline" and,
 * once the store went live, of "watch it stay right" as well:
 *
 *   - `outlines` is a STREAM, not a cell: the files belong to the disk, not to
 *     the server, so the server reports what it read rather than owning a
 *     value it could be asked to change. Every subscription opens with a full
 *     snapshot, so a reconnect is a fresh read and nothing has to be resumed,
 *     and a probe that found a change publishes the next frame down the same
 *     subscription.
 *   - `errors` is a CELL, read-only on the wire, because "what is wrong right
 *     now" is one value the server does own. It is deliberately independent of
 *     the snapshot: a set that stops validating leaves the last good tree on
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

import { OutlineError, OutlineSet } from "@olai/format"
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
 * One frame of the outline stream: the loaded set, or `null` for a set that
 * has never loaded.
 *
 * `null` is a state, not an absence. Three things a reader must tell apart —
 * "the server has not answered yet" (no frame), "the server has never had a
 * valid set to show" (`null`), "here is your outline" (a snapshot) — and a
 * nullable frame says all three with no second encoding.
 *
 * Note the two ways a frame and the error cell divide the labour, which is not
 * a duplication: `set.broken` says WHICH outline is unreadable, because that is
 * a property of the set the sidebar and the pane are drawn from, and the cell
 * says what is wrong with the set AS A WHOLE right now, which no single file
 * owns. A file listed in `broken` is being rendered around; anything in the
 * cell is being held back.
 */
export const OutlineFrame = Schema.NullOr(
  Schema.Struct({
    /** The store revision this snapshot is. Phase 4's writes name it as the
     *  base they edited; today it is what proves two frames differ. */
    rev: Schema.Int,
    set: OutlineSet,
  }),
)
export type OutlineFrame = typeof OutlineFrame.Type

/** Nothing selects a subset yet — the browser takes the whole served
 *  directory, and the sidebar is a view over it rather than a query. An empty
 *  input keeps the member's shape ready for one. */
const NoInput = Schema.Struct({})

export const surface = defineSurface({
  cells: {
    // Wire-read-only: the server is the only writer, and a write verb it never
    // serves would crash surface's boot walk.
    errors: {
      schema: Schema.Array(OutlineError),
      default: [],
      verbs: ["get"],
    },
    chat: {
      schema: ChatState,
      default: CHAT_OFF,
      verbs: ["get"],
    },
  },
  collections: {
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
  streams: {
    outlines: {
      inputSchema: NoInput,
      outputSchema: OutlineFrame,
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
