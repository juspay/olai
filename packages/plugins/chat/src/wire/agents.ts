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
 * WHAT A NODE'S SLEEP IS DOING — one server-side judgement
 * (`olai-plugin-chat`'s `server/sleep.ts`, `judge`), carried whole so the strip
 * under a conversation renders it rather than re-deriving it.
 *
 * `lastSlept` is the memo as stored and `after` is the rhythm (`sleep-after`) in
 * milliseconds: the words a person reads ("last 3h ago", "next in 4h") are those
 * two plus a clock the strip already ticks on. FIXED INSTANTS, never a rule.
 */
export const Forecast = Schema.Struct({
  lastSlept: Schema.NullOr(Schema.String),
  after: Schema.Number,
  /** HOW MANY MOVED ROWS MAKE A TIDY WORTH IT (`sleep-floor`) — carried so the
   *  strip can say "2 of 5 rows" without a second reading of the settings, which
   *  the browser cannot see. */
  floor: Schema.Number,
  /** HOW LONG A MOVED ROW MAY WAIT (`sleep-latest`), in milliseconds, for the
   *  same reason: the item's hovered sentence states the whole rule, and the
   *  rule's third clause is this span. */
  latest: Schema.Number,
  /** THERE IS NO `off` ARM, deliberately: `sleep: off` in a directory's settings
   *  is no sleeper at all, so it is a `null` forecast and not a sentence the
   *  judgement never says (`judge` has no arm for it and never had). */
  next: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("unmarked") }),
    Schema.Struct({ kind: Schema.Literal("unbound") }),
    Schema.Struct({ kind: Schema.Literal("unchanged") }),
    /** NOT ENOUGH HAS MOVED — the pressure half of the due-ness rule, with how
     *  many rows did. */
    Schema.Struct({ kind: Schema.Literal("little"), rows: Schema.Number }),
    Schema.Struct({ kind: Schema.Literal("busy") }),
    /** DUE AT AN INSTANT, with how many rows moved to make it so. */
    Schema.Struct({ kind: Schema.Literal("due"), at: Schema.String, rows: Schema.Number }),
    Schema.Struct({ kind: Schema.Literal("running") }),
    Schema.Struct({ kind: Schema.Literal("skipped"), until: Schema.String }),
  ]),
})
export type Forecast = typeof Forecast.Type

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
  /** The vault edit stamp, for activity ordering before this machine hears a turn. */
  changed: Schema.optionalKey(Schema.String),
  /**
   * WHETHER THIS CHAT IS TIDIED ON ITS OWN CLOCK — the vault's own mark
   * (`chat-agent-sleep`), a person's answer, joined onto the row so a row-menu
   * verb can label itself off the row it was drawn on. Absent and `off` are the
   * same answer, and both are "leave this one alone".
   */
  sleeps: Schema.Boolean,
  /** {@link Forecast}, or `null` where there is none to give — `sleep: off` in
   *  this directory's settings, or a sleeper that has not read the set yet. */
  sleep: Schema.NullOr(Forecast),
  /** Session lifecycle is per node, so it travels on the row rather than being
   * inferred from whichever conversation the foreground panel happens to show. */
  standing: AgentStanding,
  /** A live node panel holds an opening refusal, even without a session id. */
  unopened: Schema.optionalKey(Schema.Boolean),
  since: Schema.optionalKey(Schema.String),
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
