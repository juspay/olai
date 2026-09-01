/**
 * THE AGENTS ROSTER, ASSEMBLED — the vault's `prop:agent` reading joined with
 * this machine's session bindings.
 *
 * The roster is the one answer on this wire whose two halves are kept in two
 * different packages, deliberately and for a reason each of them argues at
 * length:
 *
 *   - `@olai/format`'s `agentsOf` is the DURABLE half. Which nodes carry an
 *     `agent` property, what they are called, how big their subtrees are — a
 *     reading of the set, true on every machine that serves it, moving on every
 *     published revision.
 *   - `@olai/chat`'s `agents.ts` is the MACHINE-LOCAL half. Which conversation
 *     each of those nodes is talking through, whether that session has been
 *     taught its contract, and the last line olai heard it say — none of which
 *     can travel, because a session id means nothing to another machine's
 *     agent.
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
 * (`@olai/chat`'s `Options.charge`) — and the chat is built BEFORE the runtime
 * that would otherwise own the reading, so a thunk over a carrier is what lets
 * the earlier of the two ask the later one's question. One carrier, written
 * once per revision, read by both.
 *
 * ## The join itself is PURE and is the interesting part
 *
 * {@link joined} takes two lists and answers the wire's rows, so which node
 * agent counts as bound, what an unbound one says, and what happens to a
 * binding whose node has gone are decided in a unit test rather than by serving
 * a directory.
 */

import { agentsOf, type Derived, NO_AGENTS, type NodeAgent, type NodeAgents } from "@olai/format"
import type { Bound } from "@olai/chat"
import { type Agents, NO_AGENT_ROSTER } from "@olai/surface"

export interface Roster {
  /**
   * A published revision arrived — re-read the vault's half.
   *
   * `null` is a store that has never loaded, and the answer is NO NODE AGENTS
   * rather than an unknown number of them: an empty roster draws nothing, which
   * is what a directory with no `agent` property anywhere draws and what the
   * sidebar showed while the first frame was arriving.
   */
  readonly seen: (derived: Derived | null) => void
  /** What the set says this node agent is, or `null` for a node it does not
   *  declare — a binding pointing at a record that has been trashed, or one
   *  whose property has come off. */
  readonly charge: (node: string) => NodeAgent | null
  /** The rows the cell carries: the vault's half, joined with the bindings
   *  handed in. */
  readonly rowsWith: (bindings: ReadonlyArray<Bound>) => Agents
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
    charge: (node) => held.find((one) => one.id === node) ?? null,
    rowsWith: (bindings) => joined(held, bindings),
  }
}

/**
 * THE ROWS, JOINED — one per node agent the VAULT knows about, in the order the
 * vault answers.
 *
 * THE VAULT LEADS, and that is the whole shape of it: the roster IS the query
 * `prop:agent`, so a node with the property is a row whether or not anybody has
 * bound a session to it, and a BINDING whose node has gone is not a row at all.
 * The second half is worth saying out loud because the record is written by
 * hand in this phase: a person who binds a node id that does not exist, or who
 * trashes a node they had bound, gets a roster that simply does not list it —
 * never a phantom row for a node nobody can open, and never a door onto a
 * record that is not there.
 *
 * A NODE WITH NO BINDING IS `session: null`, which is a state the sidebar draws
 * in its own words rather than folding into *asleep*: nothing is asleep here,
 * there is no conversation at all.
 *
 * THE FIRST BINDING WINS where a file names one node twice, which is the same
 * first-claim-wins rule the set's own id index keeps: the second row is the
 * mistake, so the first is what everything else means.
 */
export const joined = (
  agents: NodeAgents,
  bindings: ReadonlyArray<Bound>,
): Agents => {
  if (agents.length === 0) return NO_AGENT_ROSTER
  return agents.map((agent) => {
    const bound = bindings.find((row) => row.node === agent.id)
    return {
      ...agent,
      session: bound === undefined ? null : { agent: bound.agent, id: bound.session },
      // The one fact olai writes back that a face draws, `null`-on-the-wire
      // where the record carries an absent key: the wire is a decoded value a
      // browser reads per frame, and an optional key there would be one more
      // state for a face to have an opinion about — the same line `Wake.fault`
      // is drawn on one cell over.
      //
      // `taught` is NOT here, and its absence is the rule this file keeps for
      // every other member: nothing draws it. It was on the wire so that a
      // scenario could assert a second message teaches nothing — but the
      // scenario asserts that where a person would see it, in the TRANSCRIPT
      // (`packages/tests/features/node_agents.feature`), which is the stronger
      // claim and needs no field. A member no face names is served to nobody.
      said: bound?.said ?? null,
    }
  })
}
