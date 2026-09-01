/**
 * THE AGENTS ROSTER, on the wire — one row per node agent, and the two facts
 * about it that no vault can hold.
 *
 * A node agent is a NODE carrying an `agent` property, and everything durable
 * about it is a reading of the set: which node, what it is called, which engine
 * the property names, how many records are under it
 * (`@olai/format`'s `agents.ts`, which is the query `prop:agent` answered where
 * the set is). That half travels between machines because the vault does.
 *
 * WHICH CONVERSATION IT IS TALKING THROUGH DOES NOT. A session id means nothing
 * to another machine's agent — the same reason the which-conversation note is
 * per-machine — so the binding lives in this machine's state
 * (`@olai/chat`'s `agents.ts`) and reaches a browser only here, joined onto the
 * vault's row by the server that holds both.
 *
 * ## What is NOT on this row, and where it is instead
 *
 * The LIVE state — working, needs-you, idle — is not here, and the omission is
 * the point. Olai runs ONE conversation at a time, so at most one row of this
 * roster is a session that is actually up, and what it is doing is already the
 * whole subject of the `chat` cell: a status, a count of questions waiting, the
 * turn in flight. Copying any of that onto every row would be that cell's
 * answer restated per node, republished per token, and free to disagree with
 * the header drawn beside it. The browser JOINS instead
 * (`@olai/web`'s `agents/roster.ts`): this row says which conversation the node
 * is bound to, {@link ChatState.bound} says which node the open conversation
 * belongs to, and the state falls out of whether those are the same row.
 *
 * ## A CELL, for the shelf's reason
 *
 * A standing answer with no argument: it is a reading of the whole directory,
 * it does not depend on who is asking or what they are looking at, and the
 * server recomputes it whenever either half moves — a published revision, or a
 * conversation opening. `equals` is what keeps that from costing anything
 * (`./index.ts`), because nearly every revision has nothing new to say about a
 * roster of three rows.
 */

import { NodeAgent } from "@olai/format"
import { Schema } from "effect"

/**
 * ONE ROW OF THE ROSTER: the node agent as the set knows it, plus what this
 * machine knows about its session.
 *
 * The vault's fields are SPREAD rather than nested, the way {@link SessionInfo}
 * spreads a {@link Conversation}'s: what a reader wants off this is a title, an
 * engine and a state, and `row.node.title` would be a box around one fact. What
 * the spread buys over a hand-copied list of four fields is that the two
 * declarations cannot drift — a field added to the vault's reading is a field
 * on the wire, or the type checker says so.
 */
export const NodeAgentRow = Schema.Struct({
  ...NodeAgent.fields,
  /**
   * The conversation this node agent is talking through, or `null` for one
   * nobody has bound a session to.
   *
   * `null` IS A STATE A PERSON MEETS rather than a gap: bindings are written by
   * hand in this phase, so a node that has just been given an `agent` property
   * has a roster row and no session, and the row says exactly that. Drawing it
   * as *asleep* would claim a conversation that does not exist.
   *
   * THE PAIR, never the session alone, because a session id means nothing to
   * the wrong agent — the identity `SessionInfo` and the panel's own note
   * already spell (`./chat.ts`).
   */
  session: Schema.NullOr(Schema.Struct({
    /** One of `AGENTS`' ids — which agent can open this conversation. */
    agent: Schema.String,
    id: Schema.String,
  })),
  /**
   * THE LAST LINE OLAI HEARD THIS AGENT SAY, or `null` before it has heard one.
   *
   * The door's one line. It is written down beside the binding rather than read
   * off a transcript because for every node agent but the open one there IS no
   * transcript here — and the qualification is load-bearing and is drawn:
   * this is what olai heard, so a conversation somebody drove from a terminal
   * moves it not at all (`@olai/chat`'s `agents.ts`).
   */
  said: Schema.NullOr(Schema.Struct({
    /** One line, already cut to one where it was heard. */
    text: Schema.String,
    /** ISO 8601 — the door says how long ago off the reader's own clock. */
    at: Schema.String,
  })),
})
export type NodeAgentRow = typeof NodeAgentRow.Type

/** The roster, in corpus order — the order the vault's own reading answers in,
 *  which is the order the sidebar draws. */
export const Agents = Schema.Array(NodeAgentRow)
export type Agents = typeof Agents.Type

/** A directory with no node agent in it, and a server that has never loaded —
 *  one value, because both draw nothing. */
export const NO_AGENT_ROSTER: Agents = []

/** Whether two answers say the same thing — what keeps a revision that moved no
 *  node agent, and a chat frame that moved no binding, from reaching every open
 *  tab. DERIVED from the schema for `sameShelf`'s reason: a hand-written
 *  comparison is these fields spelled twice, and the next one added would
 *  simply not be compared. */
export const sameAgentRoster: (a: Agents, b: Agents) => boolean = Schema
  .toEquivalence(Agents)
