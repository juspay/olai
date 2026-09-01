/**
 * THE NODE AGENTS OF A SET — every node carrying an `agent` property, which is
 * the whole of what makes one.
 *
 * A node agent is not a thing olai stores anywhere: it is a NODE, and the
 * property is the association. The node's title is the agent's name, its `desc`
 * is its charter, and its SUBTREE is its memory — a chat session bound to it is
 * cattle, thrown away and recreated, because what the agent knows is written in
 * the outline rather than in a transcript
 * (https://github.com/juspay/oss.olai/blob/main/brainstorming/node-agents.md).
 *
 * So the roster is a QUERY and this module is that query, answered where the
 * set is: `prop:agent`, in the search grammar's own words
 * (docs/search.md), read off the derivation instead of typed into a box. Which
 * is also why there is nothing to store and nothing to keep in step — put the
 * property on a node and the row is there on the frame the store publishes;
 * take it off and the row is gone.
 *
 * ## The one custom key olai reads, named as the exception it is
 *
 * `./custom.ts` says that nothing in olai reads a key inside `custom`, and that
 * sentence is the whole difference between a system field and a person's own
 * fact. This is the exception the human ruled on 2026-09-01, and it is ONE key
 * wide: `agent`. It is written down in three places rather than assumed — here,
 * on that module's header, and in docs/format.md's Properties — because an
 * exception nobody can find is how a rule quietly stops being one.
 *
 * WHY NOT A DECLARED KIND, which is the machinery that already exists for
 * exactly this shape (`./typing.ts`, docs/live-properties.md): a kind is
 * CONTRIBUTED by a plugin, and a vault row moves it to whatever key a person
 * likes. Both halves are wrong here. A node agent is core's — it is the panel's
 * own subject, not an appliance's face — and the association is a ruled
 * spelling rather than a column somebody names: "put an `agent` prop on a node"
 * has to be true of every vault, or the sentence that creates a node agent
 * would need a second sentence about declaring one first.
 *
 * ## What travels, and what does not
 *
 * The VAULT's half only. Which session a node agent is bound to, what it last
 * said and whether it has been taught its contract are per-MACHINE facts that
 * this package has no way to know (`@olai/chat`'s `agents.ts` keeps them, for
 * the reason the which-conversation note is kept there); the wire's row is this
 * one widened with them (`@olai/surface`'s `chat.ts`).
 */

import { Schema } from "effect"

import { customText } from "./custom.ts"
import { type Derived, under } from "./derive.ts"
import { isPutAway, isRegular } from "./node.ts"

/**
 * THE KEY, spelled once.
 *
 * A CONSTANT because two packages have to agree about it and one of them is a
 * browser: this reading finds the rows, and the panel's own teaching quotes the
 * property back to the agent it is teaching (`@olai/chat`'s `teaching.ts`).
 * Neither may spell it for itself.
 */
export const AGENT_PROP = "agent"

/**
 * ONE NODE AGENT, as the set knows it.
 *
 * Four facts and no more, and each of them is a reading of the RECORD: where
 * it is, what it is called, which engine the property names, and how big its
 * memory is. Everything a person actually watches — is it working, what did it
 * last say — is about a session, which is not a fact about a vault at all.
 */
export const NodeAgent = Schema.Struct({
  /** The node's own id — what a door presses, what a binding names, and what
   *  the panel's header jumps to. */
  id: Schema.String,
  /** The outline the node is written in, root-relative. */
  file: Schema.String,
  /** The node's title, live: rename the node and the roster says the new name
   *  on the frame the store publishes, because there is no second copy of it
   *  anywhere to go stale. */
  title: Schema.String,
  /**
   * What the property SAYS, verbatim — `claude`, `grok — the kimi implementor`,
   * whatever somebody wrote.
   *
   * NOT resolved to one of the agents this machine has, and that is the honest
   * half: the property is a fact about the board and travels between machines,
   * while which agents are installed is a fact about a laptop
   * (`@olai/surface`'s `AGENTS`). A vault naming an engine nobody here has is
   * a node agent whose roster row says so rather than one that disappears.
   */
  engine: Schema.String,
  /**
   * HOW BIG ITS MEMORY IS: the records under this node, at any depth.
   *
   * The subtree IS the memory, so this is the one number that says how much
   * the agent knows — and the one a person reads to decide whether a fresh
   * session would come back knowing anything. Descendants only: a node counts
   * its subtree, not itself, the way `Move to Trash` already names one
   * (`./derive.ts`'s `under`).
   */
  memory: Schema.Int,
})
export type NodeAgent = typeof NodeAgent.Type

/** Every node agent of a set, in corpus order. */
export const NodeAgents = Schema.Array(NodeAgent)
export type NodeAgents = typeof NodeAgents.Type

/** A directory with no node agent in it, and a server that has never loaded —
 *  one value, because both draw nothing. */
export const NO_AGENTS: NodeAgents = []

/**
 * Whether two readings say the same thing — what keeps a revision that moved no
 * node agent from sending a frame to every open tab.
 *
 * `./shelf.ts`'s `sameShelf` word for word, including why it is DERIVED from
 * the schema rather than written out: a hand-rolled comparison is these fields
 * spelled a second time, and the next one added would simply not be compared —
 * a frame that is never sent, carrying a title the directory has moved past,
 * with nothing anywhere raising an error.
 */
export const sameAgents: (a: NodeAgents, b: NodeAgents) => boolean = Schema
  .toEquivalence(NodeAgents)

/**
 * THE ROSTER: every node of the set carrying an `agent` property, in corpus
 * order.
 *
 * A WHOLE-SET WALK, deliberately and measured against the alternative: there is
 * no index over custom keys and building one would be a map maintained per
 * write for a question asked once per revision, over a filter that is one field
 * test per record. What keeps it off the wire is the cell's `equals`
 * (`@olai/surface`), the way it keeps the shelf off it.
 *
 * WHAT IS LEFT OUT, and each for a rule this package already keeps everywhere:
 *
 *   - a MIRROR, which carries no fields of its own — a placement cannot hold a
 *     property, so there is nothing here to find. The narrowing is
 *     `./node.ts`'s guard rather than a field test spelled again.
 *   - WHAT WAS PUT AWAY, asked by the one predicate every live reading here
 *     asks (`./node.ts`'s `isPutAway`): an agent on a node somebody trashed or
 *     archived is not somebody you talk to, and a roster that listed one would
 *     offer a door into a record that is gone.
 *   - an EMPTY value, and a value that is a LIST. `custom` takes a list
 *     (`./custom.ts`), and "which engine" has no answer that is three of them —
 *     so a list-valued `agent` is a property this reading has nothing to say
 *     about rather than one it picks the first of.
 *
 * WHAT IS NOT LEFT OUT is a node that is DONE. The roster is the query and the
 * query is `prop:agent`; a finished lane whose row is still on the roster is a
 * property somebody has not taken off, which is a thing they can see and fix,
 * where a roster that quietly dropped it would be this reading deciding
 * something the query did not say.
 */
export const agentsOf = (derived: Derived): NodeAgents =>
  derived.nodes.flatMap((located) => {
    if (isPutAway(located.file)) return []
    if (!isRegular(located)) return []
    const engine = customText(located.node, AGENT_PROP)
    if (engine === undefined || engine === "") return []
    return [{
      id: located.node.id,
      file: located.file,
      title: located.node.title,
      engine,
      memory: under(derived, located.node.id),
    }]
  })
