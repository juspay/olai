/**
 * The whole vocabulary of what an agent tells us, and the only way anything
 * leaves {@link ./agent.ts}.
 *
 * It is a closed union rather than the protocol's own payloads, and that is the
 * seam: nothing above this file spells `session/update`, reads a `ContentBlock`
 * or knows which `configOptions` entry the model is. A consumer that needs
 * something not in here needs a new member, not a look at the wire — which is
 * what keeps the ACP version in one file and the conversation in another.
 *
 * The list is the racket bridge's, member for member, because the panel it
 * feeds is the racket panel's behaviour (docs/brainstorming/acp.md, round two).
 * A turn's END is deliberately not here: `prompt` returns its stop reason, and
 * the caller that asked is the one waiting.
 */

import type {
  AskField,
  AskOutcome,
  FileDiff,
  MissingServer,
  Spawned,
  Usage,
  Wrote,
} from "@olai/surface"

/** A slash command the agent offers. */
export interface Command {
  readonly name: string
  readonly description: string
}

/** One of the agent's stored conversations for the served directory. */
export interface Stored {
  readonly id: string
  readonly title: string | null
  readonly updatedAt: string | null
}

export type AgentEvent =
  /** The agent's prose, one chunk as it arrived. */
  | { readonly _tag: "said"; readonly text: string }
  /** A user message. Only a REPLAY carries these: live, we already know what
   *  was sent, because we sent it. */
  | { readonly _tag: "userSaid"; readonly text: string }
  /**
   * A tool call, as we last heard of it — announced or moved.
   *
   * ONE member rather than the announce/update pair the protocol has, because
   * a consumer does the same thing with both: the transcript is keyed by
   * `id`, so a second report of a call is the same row with new fields. Two
   * events would be two arms of every switch that never differ, which is a
   * distinction the wire makes and the conversation does not.
   *
   * `undefined` is "unchanged", not "cleared" — the protocol's own rule for
   * an update, and the reason an announcement is expressible here at all.
   */
  | {
    readonly _tag: "tool"
    readonly id: string
    readonly title: string | undefined
    readonly status: "pending" | "in_progress" | "completed" | "failed" | undefined
    readonly detail: string | undefined
    /** What the call has to SAY while it runs, out of the protocol's content
     *  blocks. Its own field rather than more `detail` because the two answer
     *  different questions — what was asked for, and what is happening. */
    readonly progress: string | undefined
    /** The files it REWROTE, structured — path, what was there, what is there
     *  now (`@olai/acp`'s `diffsOf`). Its own field rather than a line of
     *  `progress`, because a change flattened into a sentence is a change a
     *  panel can no longer draw. */
    readonly diffs: ReadonlyArray<FileDiff> | undefined
    /** ... and what it WROTE through the ops layer, which is never a diff: the
     *  node-level story the format's own vocabulary already has
     *  ({@link ./wrote.ts}). */
    readonly wrote: Wrote | undefined
    /** Where it is working: the follow-along file locations. */
    readonly locations: ReadonlyArray<string> | undefined
    /**
     * WHO made it: the `Agent` call this one was made inside, by that call's
     * own id — or `undefined` for a call the main agent made itself.
     *
     * The protocol has no such field, and that is the whole reason this one
     * exists: a subagent's calls arrive on the same flat feed as everything
     * else, so without it a turn that spawned three agents is drawn as one
     * agent doing everything, and the reader cannot tell that the other three
     * were ever there ({@link ./interpret.ts}'s `parentToolUseIn`).
     *
     * `undefined` reads as "unchanged" here like every field beside it, which
     * costs nothing: a call is made where it is made, so nothing ever needs
     * saying twice and nothing ever needs taking back.
     */
    readonly parent: string | undefined
    /**
     * ... and, the other way round, that this call SENT one out
     * ({@link ./interpret.ts}'s `spawnedIn`).
     *
     * The two are not one field with two directions: `parent` is answered by
     * frames a subagent produced, so it says nothing at all until the subagent
     * has produced one — and a spawned agent that is still reading its
     * instructions has produced none. This is answered by the spawn's own
     * frame, which arrives when the agent is sent out.
     *
     * `undefined` is "unchanged" like everything beside it, and it is load
     * bearing here: the beats that follow a spawn carry the agent's KIND
     * without repeating that it is one, and its completion carries neither.
     */
    readonly spawned: Spawned | undefined
  }
  /**
   * The agent asked a person something, and the turn is stopped until it is
   * answered.
   *
   * `id` is minted by {@link ./agent.ts} and is what an answer comes back
   * naming — the protocol's own correlation is a JSON-RPC request id, which is
   * a fact about the wire and not something a browser may hold.
   */
  | {
    readonly _tag: "asked"
    readonly id: string
    /** What the agent said it needs. */
    readonly message: string
    readonly fields: ReadonlyArray<AskField>
  }
  /** ... and it stopped waiting: somebody answered it, somebody dismissed it,
   *  or the agent took it back. */
  | { readonly _tag: "askSettled"; readonly id: string; readonly outcome: AskOutcome }
  /** The whole slash-command list, replaced rather than merged. */
  | { readonly _tag: "commands"; readonly commands: ReadonlyArray<Command> }
  /**
   * The MCP servers this conversation was opened with — specifically, the ones
   * it was meant to have and did NOT, and why.
   *
   * Emitted once per session opened, BEFORE the session it belongs to, because
   * the set is decided while the session is being asked for: what is handed to
   * `session/new` is the same list this is the complement of. Replaced rather
   * than merged, for the same reason `commands` is — the answer is a property
   * of one conversation, and a padi started since the last one shows up as an
   * empty list rather than as a row that has to be found and removed.
   *
   * What is NOT in here is a server the AGENT could not attach: ACP's
   * `session/new` answers with a session id and says nothing per server, so
   * whether the agent got a connection to what we handed over is a fact this
   * client is never told. Olai reports the failures it can SEE — its own
   * probe's — and does not guess at the rest.
   */
  | { readonly _tag: "servers"; readonly missing: ReadonlyArray<MissingServer> }
  /** The model this session runs, labelled the way the agent labels its own. */
  | { readonly _tag: "model"; readonly name: string | null }
  /** How full this conversation's context is, as the agent last reported it.
   *  Arrives several times a turn — the agent revises both halves as it goes —
   *  and the panel holds the newest. */
  | { readonly _tag: "usage"; readonly usage: Usage }
  /** Which stored conversation this now is. `title` is `null` until the agent
   *  has written one. */
  | { readonly _tag: "session"; readonly id: string; readonly title: string | null }
  /** The agent named the conversation. */
  | { readonly _tag: "sessionTitled"; readonly title: string }
  /**
   * ... and the conversation it named is gone: we are between sessions.
   *
   * WHY it is over decides what happens to the transcript, so it is carried
   * rather than inferred. A NEW conversation keeps the history and marks the
   * break — the panel is a log of this server's life, not of one session. A
   * LOAD is about to replay a different conversation over it, so the replay
   * clears. A DEAD agent leaves everything where it is and says so.
   */
  | {
    readonly _tag: "sessionOver"
    readonly why: "new" | "load" | "gone"
  }
  /** A `session/load` is about to replay a conversation. Everything until
   *  {@link replayEnded} is history, not news. */
  | { readonly _tag: "replayStarted" }
  | { readonly _tag: "replayEnded" }
  /** The subprocess ended and nothing asked it to. */
  | { readonly _tag: "gone"; readonly why: string }
  /** Something failed where no caller was waiting — a boot, a refused mode.
   *  Already logged: this is the sentence a person reads. */
  | { readonly _tag: "trouble"; readonly message: string }
