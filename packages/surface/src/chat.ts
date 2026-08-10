/**
 * Chat, on the wire.
 *
 * The conversation is TWO members and one verb set, and which is which follows
 * from what each of them is a fact about:
 *
 *   - **`transcript` is a collection**, keyed by entry id, served with the
 *     batched `deltas` verb. That verb IS snapshot-then-deltas: a subscriber
 *     gets every entry that already exists in one frame and then one coalesced
 *     frame per tick. So a tab opened halfway through a turn, a tab reloaded
 *     after a crash and a tab that has been listening since the first token all
 *     see the same conversation, with no replay protocol and no client-side
 *     merge. Keying it is what makes a TOOL FRAME updatable: the agent reports
 *     a call, then reports it again with a status, and the second report is an
 *     upsert on the same key rather than a second row.
 *
 *     The framework audit (docs/brainstorming/surface-utilization.md) asked for
 *     "events paired with a collection", because an event replays nothing to a
 *     late joiner. A `deltas` collection is that pair in one member — the push
 *     and the history are the same frames down the same subscription — so
 *     publishing each entry to an event as well would be one fact delivered
 *     twice and a dedup rule in the browser. Noted here rather than in a commit
 *     message because the next person to read the audit will ask.
 *
 *   - **`chat` is a cell**: which session this is, what it is called, which
 *     model is running, what slash commands the agent offers, and whether a
 *     turn is in flight. One value the server owns, read-only on the wire, and
 *     the panel header is a view of it.
 *
 *   - **the procedures are the verbs**: send, cancel, new, load, and the list
 *     the picker draws. Each declares its failure channel, so "a turn is
 *     already running" arrives as a `busy` a caller can branch on rather than
 *     as an opaque transport error.
 *
 * Nothing in the transcript is an optimistic echo. What a person typed appears
 * because the server put it there, exactly like everything else — so two tabs
 * always agree, and a send that failed never leaves a message on screen that
 * was never sent.
 */

import { BusyFailure, isOpFailure, kindOf, OpFailure, Unfinished } from "@olai/format"
import { Schema } from "effect"

/**
 * What a row of the conversation is.
 *
 * A union of five kinds rather than a struct with everything optional, because
 * the five are drawn differently and a reader has to switch on something:
 *
 *   - `user` — what was typed. Never markdown: it is quoted, not rendered.
 *   - `agent` — the agent's prose, accumulated as it streams. Rendered as
 *     markdown once the turn is done, which is a view-time decision.
 *   - `tool` — a tool call, foldable, updated in place by its own id.
 *   - `refusal` — a write the ops layer said no to, with the structured detail
 *     the refusal carried. This is the one entry olai mints on its own behalf:
 *     the agent gets the same detail in its tool result, and a person watching
 *     deserves to see the unfinished children rather than the agent's summary
 *     of them.
 *   - `notice` — the conversation reporting on itself: the agent died, a turn
 *     was cancelled, a session was loaded.
 *
 * A new conversation is not a kind: it EMPTIES this collection. The panel shows
 * one conversation, and rows whose context the agent no longer has are rows
 * nobody can follow up.
 */
export const ChatEntry = Schema.Struct({
  /** Stable within a session. A tool call keeps its id across updates, which is
   *  what makes the frame updatable rather than duplicated. */
  id: Schema.String,
  /** Where the entry sits in the conversation. The collection's key order is
   *  arrival order, which is the same thing until a session is reloaded; an
   *  explicit sequence means the panel never has to depend on that. */
  seq: Schema.Int,
  kind: Schema.Literals(["user", "agent", "tool", "refusal", "notice"]),
  /** The prose. For a tool entry this is its title. */
  text: Schema.String,
  /** `tool` only: what the agent says the call is doing right now. */
  status: Schema.optionalKey(
    Schema.Literals(["pending", "in_progress", "completed", "failed"]),
  ),
  /** `tool` only: the arguments and the result, as the agent reported them.
   *  Folded away by default — it is detail, not conversation. */
  detail: Schema.optionalKey(Schema.String),
  /** `tool` only: what the call is SAYING as it runs — the protocol's
   *  incremental content blocks. Separate from `detail` because it is the
   *  live half: a call that has been running for thirty seconds has something
   *  to show, and its arguments are not it. */
  progress: Schema.optionalKey(Schema.String),
  /** `tool` only: the files the call is working in, as `path` or `path:line`.
   *  The protocol's follow-along locations, which is what lets a reader see
   *  WHERE an agent is without unfolding anything. */
  locations: Schema.optionalKey(Schema.Array(Schema.String)),
  /** `refusal` only: the refusal itself, so the panel draws the unfinished
   *  children as rows rather than printing a sentence about them. */
  refusal: Schema.optionalKey(OpFailure),
  /** True while the agent is still adding to this entry. The panel shows a
   *  cursor; nothing else depends on it. */
  streaming: Schema.optionalKey(Schema.Boolean),
})
export type ChatEntry = typeof ChatEntry.Type

/** One of the agent's stored conversations, as the picker lists them. */
export const SessionInfo = Schema.Struct({
  id: Schema.String,
  /** What the agent named it. `null` until it has decided — a fresh session
   *  says its id first and its name later. */
  title: Schema.NullOr(Schema.String),
  /** ISO 8601, which is why the list can be sorted as strings. */
  updatedAt: Schema.NullOr(Schema.String),
})
export type SessionInfo = typeof SessionInfo.Type

/** A slash command the agent offers, as the input's completion draws it. */
export const Command = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
})
export type Command = typeof Command.Type

/**
 * Where the conversation stands. Everything the header draws and everything a
 * composer needs to know about whether it may send.
 */
export const ChatState = Schema.Struct({
  /**
   * What the one session is doing.
   *
   *   - `booting` — the agent is starting, or being asked for its sessions.
   *     A prompt typed now is accepted and sent when the handshake finishes.
   *   - `idle` — ready.
   *   - `thinking` — a turn is in flight. Sending is still allowed: the
   *     message goes in the transcript and QUEUES, and is prompted the moment
   *     this turn ends. A person who has thought of the next thing should not
   *     have to hold it in their head until an agent is ready for it.
   *   - `gone` — the agent is not there. `trouble` says why, and the next
   *     prompt retries the boot.
   *   - `off` — no ACP agent is configured. The panel still DRAWS and says so,
   *     naming the variable that would give it one: a capability that is
   *     silently absent cannot be told apart from one that is broken. The
   *     server serves the outlines either way.
   */
  status: Schema.Literals(["off", "booting", "idle", "thinking", "gone"]),
  /** The session the server is in, or `null` between sessions. */
  session: Schema.NullOr(SessionInfo),
  /** The model a turn actually runs on, labelled the way the agent labels its
   *  own models. `null` until the agent has said. */
  model: Schema.NullOr(Schema.String),
  commands: Schema.Array(Command),
  /** How many messages are typed and waiting for the turn in flight to end.
   *
   *  A count rather than the messages themselves, because the messages are
   *  already in the transcript: what you typed is a row the moment you send
   *  it, in the order you meant it, and this is only the panel's way of saying
   *  the agent has not reached them yet. */
  queued: Schema.Int,
  /** The last thing that went wrong where no caller was waiting — a boot that
   *  failed, an agent that died mid-turn. `null` once a turn succeeds. */
  trouble: Schema.NullOr(Schema.String),
})
export type ChatState = typeof ChatState.Type

/** What a page sees before any frame arrives, and what the cell holds when
 *  there is no agent configured at all. The panel draws in this state — see
 *  `status` above — so this is a value a reader ends up looking at, not a
 *  placeholder for one. */
export const CHAT_OFF: ChatState = {
  status: "off",
  session: null,
  model: null,
  commands: [],
  queued: 0,
  trouble: null,
}

/** Why a chat verb said no. `OpFailure`'s five kinds already cover it — `busy`
 *  for a turn in flight, `not-found` for a session that is gone, `usage` for an
 *  empty prompt — and a second vocabulary would be a second thing to decode. */
export const ChatFailure = OpFailure

/** Re-exported so a consumer of the surface can name a refusal, ask which
 *  KIND it is and draw its children without also depending on the format
 *  package: the browser subscribes to this spec, not to the format, and a
 *  second answer to "which kind is this" is exactly what it must not have. */
export { BusyFailure, isOpFailure, kindOf, OpFailure, Unfinished }
