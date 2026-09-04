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

/**
 * THE MIGRATION THIS VAULT IS OWED, or `null` — the sentence a board that
 * carries bindings under the bare key is told, and the row that ends it.
 *
 * ## Why this is the PLUGIN's and not the validator's
 *
 * It was a validator finding (`@olai/format`'s `legacy-key`), and the cost of
 * that was the whole of the objection: by the error model a finding BREAKS the
 * file it is filed on, and the only honest file for this one is the
 * declarations page — so a release that shipped the notice put every vault
 * carrying a pre-migration binding into errors-only ON THE ONE FILE every
 * declared kind depends on, and refused every other write to it until somebody
 * pasted the row. A notice that darkens the page it is asking you to edit is a
 * notice that costs more than the thing it is about.
 *
 * The kind is this plugin's, the retired spelling is this plugin's, and the
 * word to paste is this plugin's composed claim. So the sentence is this
 * plugin's too, and saying it here costs the vault nothing: no finding, no
 * broken file, no refused write.
 *
 * ## WHERE IT IS DRAWN is the reason it needs no alarm
 *
 * The agents section, which is EMPTY exactly when this is owed — the roster is
 * the query over the declared key, so a vault whose key nothing declares has no
 * node agents to list. A person who went looking for an agent that has stopped
 * appearing finds this in the place they went looking, which is what the
 * validator's sentence was for and the only part of it worth keeping.
 */
export const Migration = Schema.Struct({
  /** The retired spelling the records actually carry — what to search for. */
  key: Schema.String,
  /** ...and the word it is now: this plugin's composed claim, quoted rather
   *  than spelled, so a rename cannot leave the sentence naming a kind nobody
   *  registers. */
  kind: Schema.String,
  /** The declarations file the row goes in: the one this vault already declares
   *  in, or the one it would mint. */
  at: Schema.String,
  /** The records holding it, capped — a vault with two hundred would otherwise
   *  put its whole node list in one sentence. */
  holding: Schema.Array(Schema.String),
  /** How many more there are beyond {@link holding}, so the cap is a cap a
   *  reader can see rather than a silent truncation. */
  more: Schema.Int,
})
export type Migration = typeof Migration.Type

/** Nothing owed — every vault that has said the word, and every vault that
 *  never used the old one. */
export const NO_MIGRATION = null

/** At most this many records are named in one sentence, the idiom a refusal
 *  over a roster already keeps. */
export const NAMED_AT_MOST = 5
