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
 * feeds is the racket panel's behaviour (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/acp.md, round two).
 * A turn's END is deliberately not here: `prompt` returns its stop reason, and
 * the caller that asked is the one waiting.
 */

import type {
  Armed,
  AskField,
  AskOutcome,
  ChatServer,
  FileDiff,
  Spawned,
  ToolStatus,
  Usage,
  Wrote,
} from "@olai/surface"

/** A slash command the agent offers. */
export interface Command {
  readonly name: string
  readonly description: string
}

/**
 * One of the agent's stored conversations for the served directory.
 *
 * `messageCount` and `supersededBy` come from the adapter's OWN corner of the
 * answer (`_meta.claudeCode` on the pinned Claude Code adapter —
 * `acp/patches/session-list-info.patch`, the lane in
 * {@link ./agents/claude.ts}'s `listedIn`), so they are facts that exist only
 * where an adapter chooses to volunteer them. `null` — the reading's losing
 * direction — is what the request's absence produces, and the picker's answer
 * for it is to draw nothing rather than a zero or a guessed pair.
 */
export interface Stored {
  readonly id: string
  readonly title: string | null
  readonly updatedAt: string | null
  readonly messageCount: number | null
  readonly supersededBy: string | null
}

export type AgentEvent =
  /** The agent's prose, one chunk as it arrived. */
  | { readonly _tag: "said"; readonly text: string }
  /** What a PERSON said, ONE CHUNK as it arrived — the same unit `said`
   *  carries, because it is the same unit the wire carries. Only a REPLAY
   *  brings these: live, we already know what was sent, because we sent it,
   *  and we have the whole of it before any of it is on the wire.
   *
   *  Saying "a chunk" is not pedantry here; it is the line that was missing.
   *  This used to read "a user message", and the consumer wrote a ROW per
   *  event on the strength of it — so a replayed message came back as one
   *  bubble per piece the agent had kept it in. */
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
    /** WHAT THE CALL IS DOING, in the surface's own four words rather than a
     *  fifth spelling of them. It used to be spelled out here, which made three
     *  lists of one vocabulary — the SDK's `ToolCallStatus`, this, and the
     *  wire's — and the seam in {@link ./agent.ts} is where a fifth ACP status
     *  now has to be met rather than cast past. `undefined` is "unchanged". */
    readonly status: ToolStatus | undefined
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
     * were ever there ({@link ./agents/leg.ts}'s `parentToolUse`).
     *
     * `undefined` reads as "unchanged" here like every field beside it, which
     * costs nothing: a call is made where it is made, so nothing ever needs
     * saying twice and nothing ever needs taking back.
     */
    readonly parent: string | undefined
    /**
     * ... and, the other way round, that this call SENT one out
     * ({@link ./agents/leg.ts}'s `spawned`).
     *
     * The two are not one field with two directions: `parent` is answered by
     * frames a subagent produced, so it says nothing at all until the subagent
     * has produced one — and a spawned agent that is still reading its
     * instructions has produced none. This is answered by the spawn's own
     * frame, which arrives when the agent is sent out.
     *
     * `undefined` is "unchanged" like everything beside it, and it is load
     * bearing here: most of what follows a spawn — its heartbeats, its
     * completion — says nothing about being one, and a row that read that
     * silence as "not a spawn now" would lose the face at the moment the
     * agent came back.
     */
    readonly spawned: Spawned | undefined
    /**
     * ... and that it ARMED A BACKGROUND TASK — a monitor, a background shell,
     * an agent sent out to run past this turn ({@link ./agents/leg.ts}'s
     * `backgroundTask`).
     *
     * The third thing a call can leave behind and the only one that goes on
     * happening: the tool answers at the moment the task starts, so without
     * this the frame that says "running" and the frame that says "finished" are
     * the same frame, and everything the harness says afterwards has no row to
     * land on.
     *
     * `undefined` is "unchanged" like everything beside it, and it is load
     * bearing in both directions: the frame that ARMS the call says nothing
     * about an ending, and the frame that ENDS it need not repeat the
     * description it was armed with.
     */
    readonly armed: Armed | undefined
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
    /**
     * WHICH agent is asking: the `Agent` call the question came out of, by
     * that call's own id — or `undefined` for one the main agent asked itself.
     *
     * The same field a `tool` event carries and answered the same way, because
     * it is the same question about a different frame. It has to be here for
     * the reason it has to be there: a subagent's question reaches olai on the
     * one feed everything else does, so a form drawn without it is drawn in
     * the main agent's voice — and a permission form is the one row where
     * being wrong about who is asking changes what a person decides.
     *
     * Unlike its sibling this is never "unchanged": a question is asked once,
     * by one agent, and the row is written from this event alone.
     */
    readonly parent: string | undefined
  }
  /** ... and it stopped waiting: somebody answered it, somebody dismissed it,
   *  or the agent took it back. */
  | { readonly _tag: "askSettled"; readonly id: string; readonly outcome: AskOutcome }
  /** The whole slash-command list, replaced rather than merged. */
  | { readonly _tag: "commands"; readonly commands: ReadonlyArray<Command> }
  /**
   * WHAT THIS AGENT SAID IT CAN DO, once per handshake — the two facts about a
   * running agent the panel cannot work out for itself.
   *
   * Not `initialize`'s payload and deliberately not near it: what crosses is
   * two booleans a leg read ({@link ./agents/leg.ts}), so nothing above this
   * file learns that agents advertise anything, let alone where.
   *
   * ONCE PER AGENT rather than per session, because that is when it is said:
   * the handshake happens when a subprocess starts, and every conversation that
   * subprocess then holds is with the same agent. It arrives AFTER the panel
   * has been told which agent it is talking to and before that agent's first
   * turn — so a panel between the two makes no promise and offers no
   * interruption, which is what a panel that has not been told yet honestly
   * has.
   */
  | {
    readonly _tag: "advertised"
    /** It takes a message INTO the turn it is running, if asked on purpose.
     *  What the composer draws its one interrupting control from. */
    readonly steers: boolean
    /** It HOLDS a message sent while it is busy and runs it when the turn is
     *  over. What lets the composer promise a person their words will be got
     *  to, on the agent's own word. */
    readonly queues: boolean
  }
  /**
   * The MCP servers this conversation has, and how each one stands — the whole
   * roster, healthy rows included ({@link ./servers.ts}).
   *
   * Emitted once per session opened, BEFORE the session it belongs to, because
   * the set is decided while the session is being asked for: what is handed to
   * `session/new` is the same list this is read off. Replaced rather than
   * merged, for the same reason `commands` is — the answer is a property of one
   * conversation, and a padi started since the last one shows up as a healthy
   * row rather than as a failure that has to be found and removed.
   *
   * ... and AGAIN whenever the agent says something new about them. #140's
   * version of this event fired once per session because olai's own probe was
   * the only source there was: ACP's `session/new` answers with a session id
   * and says nothing per server. One agent does say — the Claude Code adapter
   * forwards a status per server on its CLI's `system`/`init`
   * ({@link ./agents/claude.ts}) — and that arrives per turn, after the session
   * is open. So this is no longer a fact settled at session open; it is one
   * that can be refined by whoever knows better, and only ever by them
   * ({@link ./servers.ts}'s `movedBy`).
   */
  | { readonly _tag: "servers"; readonly servers: ReadonlyArray<ChatServer> }
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
