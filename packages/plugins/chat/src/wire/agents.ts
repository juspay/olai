/**
 * THE AGENTS ROSTER, on the wire — one row per node agent, and the ONE fact
 * about it that no vault holds.
 *
 * A node agent is a NODE carrying an `agent-session` property, and nearly
 * everything about it is a reading of the set: which node, what it is called,
 * which engine and which conversation the property names, how many records are
 * under it (`@olai/format`'s `agents.ts`, which is the query
 * `prop:agent-session` answered where the set is). All of that travels between
 * machines, because the vault does — the session pointer included, since the
 * human's 2026-09-02 ruling put every piece of config in the vault.
 *
 * WHAT THIS MACHINE ADDS is the session's live standing, its waiting-question
 * count, and the last thing olai HEARD it say. None is vault configuration and
 * none can be reconstructed by a browser, so the server that owns the node
 * scopes joins all three onto the durable row.
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

export const AgentStanding = Schema.Union([
  Schema.Literal("needs-you"),
  Schema.Literal("working"),
  Schema.Literal("waking"),
  Schema.Literal("idle"),
  Schema.Literal("gone"),
  Schema.Literal("asleep"),
  Schema.Literal("unbound"),
])
export type AgentStanding = typeof AgentStanding.Type

/**
 * ONE ROW OF THE ROSTER: the node agent as the set knows it, plus what this
 * machine knows about its session.
 *
 * The vault's fields are SPREAD rather than nested, the way {@link SessionInfo}
 * spreads a {@link Conversation}'s: what a reader wants off this is a title, an
 * engine and a state, and `row.node.title` would be a box around one fact. What
 * the spread buys over a hand-copied list is that the two declarations cannot
 * drift — a field added to the vault's reading is a field on the wire, or the
 * type checker says so.
 *
 * WHICH CONVERSATION, and with WHICH AGENT, are `session` and `engine` from
 * that spread. The pair is what opens one (`chat.loadSession` takes both,
 * because a session id means nothing to the wrong agent) and the browser reads
 * them off one row rather than off a nested object minted here.
 */
export const NodeAgentRow = Schema.Struct({
  ...NodeAgent.fields,
  /** Session lifecycle is per node, so it travels on the row rather than being
   * inferred from whichever conversation the foreground panel happens to show. */
  standing: AgentStanding,
  waiting: Schema.Int,
  /**
   * THE LAST LINE OLAI HEARD THIS AGENT SAY, or `null` before it has heard one.
   *
   * The door's one line. It is written down beside the binding rather than read
   * off a transcript because for every node agent but the open one there IS no
   * transcript here — and the qualification is load-bearing and is drawn:
   * this is what olai heard, so a conversation somebody drove from a terminal
   * moves it not at all (`olai-plugin-chat`'s `sessions.ts`).
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
