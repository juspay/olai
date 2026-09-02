/**
 * THE AGENTS ROSTER, ASSEMBLED — the vault's `prop:agent-session` reading with
 * the one line this machine overheard joined onto it.
 *
 * The roster is the one answer on this wire whose two halves are kept in two
 * different packages, deliberately and for a reason each of them argues at
 * length:
 *
 *   - `@olai/format`'s `agentsOf` is the DURABLE half, and since the human's
 *     2026-09-02 ruling it is nearly the whole thing. Which nodes carry an
 *     `agent-session` property, what they are called, which engine and which
 *     session the property names, how big their subtrees are — a reading of the
 *     set, moving on every published revision.
 *   - `@olai/chat`'s `sessions.ts` is the MACHINE-LOCAL half, and it is now one
 *     fact wide: the last line olai HEARD one of those sessions say. It is
 *     bookkeeping rather than config — a board written to on every turn is a
 *     board committed on every turn — which is exactly why the ruling left it
 *     on the machine.
 *
 * Neither package may hold the other's: the format has never seen a session and
 * the chat has never seen an outline. So the join is HERE, at the composition
 * root, which is the only place both are in hand — the same arrangement the
 * doorbells already live under, where core holds the served set and the plugin
 * holds the pick.
 *
 * ## Why this is a module and not four lines in the connector
 *
 * Because the carrier is shared by two readers that run at different times.
 * The CELL wants the join, per revision and per chat frame. The TEACHING wants
 * one row of the vault half, synchronously, in the middle of somebody's send
 * (`@olai/chat`'s `Options.agentAt`) — and the chat is built BEFORE the runtime
 * that would otherwise own the reading, so a thunk over a carrier is what lets
 * the earlier of the two ask the later one's question. One carrier, written
 * once per revision, read by both.
 *
 * ## The two readings point in OPPOSITE directions, which is the shape here
 *
 * The cell asks "for this node, what is its session?" and the teaching asks
 * "for this conversation, whose node agent is it?" — the same property read
 * from either end. Both are a scan over a list that is a handful of rows on any
 * real vault and is re-read per revision anyway; an index keyed the other way
 * would be a second copy of the property to keep in step.
 *
 * ## The join itself is PURE and is the interesting part
 *
 * {@link joined} takes two lists and answers the wire's rows, so what an agent
 * nobody has started a session for says, and what happens to a line olai heard
 * in a session the property no longer names, are decided in a unit test rather
 * than by serving a directory.
 */

import type { Conversing, Overheard } from "@olai/chat"
import { agentsOf, type Derived, NO_AGENTS, type NodeAgent, type NodeAgents } from "@olai/format"
import { type Agents, NO_AGENT_ROSTER } from "@olai/surface"

export interface Roster {
  /**
   * A published revision arrived — re-read the vault's half.
   *
   * `null` is a store that has never loaded, and the answer is NO NODE AGENTS
   * rather than an unknown number of them: an empty roster draws nothing, which
   * is what a directory with no `agent-session` property anywhere draws and
   * what the sidebar showed while the first frame was arriving.
   */
  readonly seen: (derived: Derived | null) => void
  /**
   * WHOSE NODE AGENT THIS CONVERSATION IS, or `null` for one no node claims —
   * which is nearly every conversation, and also a property still naming a
   * session in a record somebody has since trashed.
   *
   * THE FIRST NODE WINS where two properties name one session, which is the
   * same first-claim-wins rule the set's own id index keeps: a session belongs
   * to one node agent, so a second node naming it is somebody's copied
   * property rather than a second answer.
   */
  readonly agentAt: (to: Conversing) => NodeAgent | null
  /** The rows the cell carries: the vault's half, wearing what olai overheard
   *  the sessions it names say. */
  readonly rowsWith: (overheard: ReadonlyArray<Overheard>) => Agents
}

/** The carrier and the two readings over it — one per served directory, built
 *  at the composition root. */
export const roster = (): Roster => {
  // The vault's half, replaced whole per revision. A `let` and not a
  // `SubscriptionRef`: both readers are synchronous and neither wants to be
  // woken — the cell's connector is already running on the revision that moved
  // this, and the teaching asks in the middle of a send.
  let held: NodeAgents = NO_AGENTS
  return {
    seen: (derived) => {
      held = derived === null ? NO_AGENTS : agentsOf(derived)
    },
    agentAt: (to) =>
      held.find((one) => one.engine === to.agent && one.session === to.session) ?? null,
    rowsWith: (overheard) => joined(held, overheard),
  }
}

/**
 * THE ROWS, JOINED — one per node agent the VAULT knows about, in the order the
 * vault answers.
 *
 * THE VAULT LEADS, and that is the whole shape of it: the roster IS the query
 * `prop:agent-session`, so a node with the property is a row whether or not
 * anybody has started a session for it, and a line olai overheard in a session
 * no property names is not a row at all — it is a conversation the panel is
 * simply in, and the record ages it out ({@link @olai/chat}'s `sessions.ts`).
 *
 * A NODE AGENT WITH NO SESSION carries `session: null`, which is a state the
 * sidebar draws in its own words rather than folding into *asleep*: nothing is
 * asleep there, there is no conversation at all.
 *
 * WHAT OLAI HEARD IS MATCHED ON THE PAIR, never on the session alone: a session
 * id means nothing to the wrong agent, and a property that has been re-pointed
 * at another engine's conversation must not wear the line the old one said.
 */
export const joined = (
  agents: NodeAgents,
  overheard: ReadonlyArray<Overheard>,
): Agents => {
  if (agents.length === 0) return NO_AGENT_ROSTER
  return agents.map((agent) => ({
    ...agent,
    // The one fact olai writes back that a face draws, `null`-on-the-wire
    // where the record carries an absent key: the wire is a decoded value a
    // browser reads per frame, and an optional key there would be one more
    // state for a face to have an opinion about — the same line `Wake.fault`
    // is drawn on one cell over.
    said: (agent.session === null
      ? undefined
      : overheard.find((row) => row.agent === agent.engine && row.session === agent.session)
        ?.said) ?? null,
  }))
}
