/**
 * WHAT AN AGENT-ASSOCIATED SESSION IS TOLD, ONCE, AND HOW IT ARRIVES.
 *
 * The keystone of node agents, and the reason the rest of the feature is not
 * decoration: a node's subtree is only the agent's memory if the AGENT WRITES
 * INTO IT. The orchestrator has run that discipline by hand since August — *the
 * session memory dies with the session; the board is the memory; a fresh
 * session must be able to read the board and know everything a dead session
 * knew* — and node agents are that discipline turned into product, which means
 * the standing instruction has to be product too rather than a paragraph
 * somebody remembers to paste
 * (https://github.com/juspay/oss.olai/blob/main/brainstorming/node-agents.md,
 * "write-back discipline is the whole trick").
 *
 * ## THE CHANNEL: a first-turn preamble, and not a system prompt
 *
 * The design left the channel open and named the two candidates. This is the
 * ruling and its reasons, all four of which are about what the OTHER one would
 * have cost:
 *
 *   - **ACP has no system prompt.** `session/new` carries a cwd and a list of
 *     MCP servers and nothing else a client may put words in ({@link
 *     ./agent.ts}); there is no field, on either leg. Getting one would mean
 *     patching the pinned adapter — a fifth patch, on a surface upstream has
 *     never offered — and then the feature would be *absent on opencode and on
 *     pi*, which is exactly the shape this repo refuses: a capability silently
 *     missing cannot be told apart from one that is broken.
 *   - **A preamble is IN THE TRANSCRIPT**, where a person can read what their
 *     agent was told. A system prompt is a thing that happened to somebody
 *     else's process, and the panel would be claiming a contract nobody can
 *     see. Every other thing olai adds to a message is visible in exactly this
 *     way ({@link ./prompt.ts} — the attachments and the armed nodes), and this
 *     rides the same seam rather than inventing a second one.
 *   - **It costs a turn only where there is one.** Sessions spawn lazily and
 *     reap when idle; a node agent nobody talks to should cost nothing, and a
 *     teaching delivered AT OPEN would spend a whole turn per boot on every
 *     agent the panel happened to restore. Riding the first message spends
 *     nothing until somebody says something, and then spends no turn at all —
 *     the lines go with the words.
 *   - **It survives a `/clear` and a fresh session by construction**, because
 *     "has this conversation been taught" is written down per SESSION
 *     ({@link ./sessions.ts}'s `Overheard.taught`). A new session is untaught, which
 *     is right: the whole point of the contract is that the transcript is not
 *     what carries it.
 *
 * The cost, named rather than left to be found: the FIRST message a person
 * sends to a node agent is longer than what they typed, and the agent's answer
 * may open by acknowledging its charter instead of answering. That is one turn
 * per session, and it is the turn the discipline is established in.
 *
 * ## What it says, and what it deliberately does not
 *
 * Three facts and no advice: WHICH node this conversation belongs to, that the
 * node's subtree is the memory, and that the transcript is history. No tool
 * names — which verbs are reachable is a property of the servers that
 * conversation was handed ({@link ./servers.ts}), and an instruction naming a
 * call the session does not have would be teaching a contract it cannot keep.
 * No charter either: the node's `desc` IS the charter and the agent is being
 * pointed at the node, so quoting it here would be the second copy this whole
 * design exists to avoid.
 *
 * PURE, over a {@link NodeAgent}, so what an agent is told is decided in a unit
 * test rather than by starting one. It takes the vault's own reading of a node
 * agent rather than a shape of this file's — the four facts the words need ARE
 * that reading's four fields, and a `Charge` declared here was that row spelled
 * a second time in a package that cannot check it against the first.
 */

import { memoryOf, type NodeAgent } from "@olai/format"

/**
 * HOW THIS CONVERSATION CAME TO BELONG TO ITS NODE, which is the one thing the
 * contract has to say differently.
 *
 * `opened` is a conversation olai opened FOR the node — it knows nothing that
 * is not in its subtree, because it has not said anything yet.
 *
 * `assigned` is a chat that already existed and was moved to a node
 * ({@link ./sessions.ts}'s `Overheard.assigned`, and the migration this phase
 * ships): everything it knows is in a transcript that has just stopped being
 * its memory. So the standing law is the same law with an ORDER in front of
 * it — bank what you know, now, before the transcript stops mattering. It is
 * the one turn where "write standing facts as you learn them" is not enough,
 * because nothing new is going to be learnt: the knowledge is already there and
 * is about to be in the wrong place.
 */
export type Arrival = "opened" | "assigned"

/**
 * WHAT THE AGENT IS TOLD, as the lines {@link ./prompt.ts}'s `annotated` puts
 * under a message — one line per thing, in the order they are given.
 *
 * TWO LINES: who it is, and what that means. They are separate because they age
 * differently — the first is a fact about this conversation and the second is
 * the standing law, and a reader comparing two agents' first turns should be
 * able to see that the law is the same sentence both times.
 *
 * AN EMPTY SUBTREE IS SAID rather than skipped, and it is the case a fresh node
 * agent is actually in: "nothing under it yet" is an instruction to start
 * writing, where a line claiming a memory of zero rows would read as a memory
 * that failed to load.
 *
 * ## THE MIGRATION VARIANT is the same two lines with the same shape
 *
 * An assigned session is told the same two things in the same order — which
 * node, and what its subtree is — because they are the same two facts, and a
 * reader comparing an assigned agent's first turn with an opened one's should
 * see one contract rather than two. What differs is a clause on each: that this
 * conversation was moved here (it was somebody's chat a moment ago and its
 * transcript is the only copy of what it knows), and that the first thing to do
 * about that is WRITE THE STANDING FACTS DOWN. The distillation order is a
 * sentence in the contract rather than a turn of its own, for the reason the
 * whole teaching is a preamble: a turn spent before anybody has said anything
 * is a turn spent on every migrated chat whether or not it is ever used again.
 */
export const teachingFor = (
  agent: NodeAgent,
  how: Arrival = "opened",
): ReadonlyArray<string> => [
  how === "assigned"
    ? `[olai] This conversation has been ASSIGNED to the node agent “${agent.title}” — the node \`${agent.id}\` in \`${agent.file}\`. It was an ordinary chat until now; from here it is that node's current session.`
    : `[olai] This conversation is the node agent for “${agent.title}” — the node \`${agent.id}\` in \`${agent.file}\`.`,
  how === "assigned"
    ? `[olai] That node's SUBTREE is NOW your memory (${
      agent.memory === 0 ? "nothing under it yet" : memoryOf(agent)
    }): read it, and then WRITE INTO IT — the standing facts this transcript is currently the only copy of, the decisions, what you are in the middle of, what a successor would need. This transcript is HISTORY, not memory — the session can be thrown away and recreated at any time, and the next one must be able to read that subtree and know everything this one knew.`
    : `[olai] That node's SUBTREE is your memory (${
      agent.memory === 0 ? "nothing under it yet" : memoryOf(agent)
    }): read it to find out what you already know, and write standing facts back into it as you learn them. This transcript is HISTORY, not memory — the session can be thrown away and recreated at any time, and the next one must be able to read that subtree and know everything this one knew.`,
]
