/**
 * WHAT AN AGENT-ASSOCIATED SESSION IS TOLD, ONCE — AND REMINDED OF — AND HOW
 * IT ARRIVES.
 *
 * A node's subtree is a knowledge base organized by topic. The teaching tells
 * the agent when that knowledge base changes — when a durable fact did — and
 * that the change edits the node already holding the fact rather than adding a
 * new one beside it.
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
 * ## ...AND A REMINDER, because once was not enough
 *
 * A long conversation compacts, and a preamble on its first message is exactly
 * what compaction drops. What production showed is the agent drifting back to
 * its default — filing a node per message — long after the contract went out.
 * So every Nth message a node agent takes carries {@link REMINDER}: the write
 * trigger and the shape rule in one sentence, on the same seam and as the same
 * kind of notice, so a person reads what the agent was reminded of. The count
 * and the period are the session record's and the chat setting's
 * ({@link ./sessions.ts}'s `Overheard.taken`, `./settings.ts`'s
 * `remind-every`); this file only says the words.
 *
 * ## What it says, and what it deliberately does not
 *
 * The node this conversation belongs to, that the node's own note is its
 * charter, WHEN to write to the subtree and in what shape. No tool names —
 * which verbs are reachable is a property of the servers that conversation was
 * handed ({@link ./servers.ts}), and an instruction naming a call the session
 * does not have would be teaching a contract it cannot keep. The charter is
 * POINTED AT, never quoted: the node's `desc` IS the charter and the agent can
 * read it, so quoting it here would be the second copy this whole design
 * exists to avoid — but an agent never told that the note is its charter reads
 * it as one more row.
 *
 * NOT "MEMORY", deliberately, except in {@link HARNESS_MEMORY_OFF}, which is
 * about the engine's own memory feature being off. The contract used to call
 * the subtree "your memory" five times and say "maintain it as you learn"; an
 * agent told its memory is a place to write treated every exchange as
 * something to remember and filed a node per message. A knowledge base
 * organized by topic is a thing a fact goes INTO, and the trigger comes before
 * anything else, in the negative: answer, and write only when a durable fact
 * changed.
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
 * `assigned` is an existing chat moved to a node. It must reconcile relevant
 * knowledge from the conversation with the subtree it now belongs to.
 */
export type Arrival = "opened" | "assigned"

/**
 * WHAT THE AGENT IS TOLD, as the lines {@link ./prompt.ts}'s `annotated` puts
 * under a message — one line per thing, in priority order.
 *
 * WHO FIRST, AND THE CHARTER WITH IT: which node, and that its note outranks
 * every default below. Then THE LAW — when to write, then in what shape — which
 * is the same lines word for word under both arrivals, so a reader comparing
 * two agents' first turns sees one law. Then the assigned variant's one extra
 * order, and last the line about the engine's own memory.
 *
 * AN EMPTY SUBTREE IS SAID rather than skipped, and it is the case a fresh node
 * agent is actually in: "nothing under it yet" tells it there is nothing to
 * read, where a line claiming a knowledge base of zero rows would read as one
 * that failed to load.
 *
 * ## THE MIGRATION VARIANT is the same lines plus one
 *
 * An assigned session is told the same things in the same order — which node,
 * the charter, the law — because they are the same facts, and a reader
 * comparing an assigned agent's first turn with an opened one's should see one
 * contract rather than two. What differs is the first line, which says this
 * conversation was moved here, and one line more: reconcile what this
 * conversation already knows into the subtree, updating what is there. The
 * distillation order is a line in the contract rather than a turn of its own,
 * for the reason the whole teaching is a preamble: a turn spent before anybody
 * has said anything is a turn spent on every migrated chat whether or not it
 * is ever used again.
 */
export const teachingFor = (
  agent: NodeAgent,
  how: Arrival = "opened",
): ReadonlyArray<string> => {
  const says = SAYS[how]
  return [
    `[olai] ${says.who(agent)} ${CHARTER}`,
    `[olai] ${TRIGGER(agent.memory === 0 ? "nothing under it yet" : memoryOf(agent))}`,
    `[olai] ${SHAPE}`,
    ...(says.reconcile === null ? [] : [`[olai] ${says.reconcile}`]),
    `[olai] ${HARNESS_MEMORY_OFF}`,
  ]
}

/**
 * THE REMINDER — the law in one line, for the Nth message after the teaching.
 *
 * ONE SENTENCE: the trigger and the shape, compressed, and nothing about which
 * node — the conversation already knows that, and a reminder that re-told it
 * would be a second preamble. A whole `[olai] ` line, because it rides the
 * seam the teaching rides and is the notice a person reads verbatim.
 */
export const REMINDER =
  "[olai] Reminder: answer first, and write to this node's subtree only when a durable fact changed — update the node that holds it, add a node only for a fact that is new, and never record messages, questions, your own actions or a running account of the conversation."

/**
 * THE AGENT'S OWN MEMORY IS OFF — the sentence both contracts end on.
 *
 * Under every engine the agent keeps no memory of its own here: Claude and
 * Codex have one the switch takes away, and opencode, pi and omp have nothing
 * to switch off. Either way, this subtree is the only memory, and the sentence
 * says so without naming one engine's mechanism — the same words under every
 * agent, so a reader comparing two first turns sees one contract.
 *
 * THE ONE PLACE THE WORD "MEMORY" STAYS: it is about the engine's feature, not
 * about the subtree's job.
 *
 * EXPORTED, and the third caller is why: a sleep turn arrives in a conversation
 * that has already been taught, so the sentence cannot come with a preamble
 * that will not be sent — it is restated by the instruction instead
 * (`./sleep.ts`). One spelling, three turns, and an agent that has been told
 * once reads the same words again rather than a paraphrase of them.
 */
export const HARNESS_MEMORY_OFF =
  "You have no memory of your own here: this subtree is the only memory."

/** The node's note outranks the defaults — appended to the first line under
 *  both arrivals, so it is the same words whichever way the session came. */
const CHARTER =
  "That node's own note is your charter: where it says otherwise, it overrides everything below."

/**
 * THE WRITE TRIGGER, FIRST AND IN THE NEGATIVE — spelled ONCE, so both
 * contracts carry the same law.
 *
 * The count rides it because it is the one fact about the subtree the agent
 * cannot see without reading it: how much there already is.
 */
const TRIGGER = (count: string): string =>
  `That node's SUBTREE is your knowledge base, organized by topic (${count}): read it for what is already known. Answer first, and write to it only when a durable fact changed — a decision, a finding, a ruling or preference of the person, a standing state of the world. Never record messages, questions, your own actions, or a running account of the conversation.`

/** ... and THE SHAPE a write takes, once — the rule that keeps a fact in one
 *  node rather than a new node per telling of it. */
const SHAPE =
  "One node per fact: update the node that already holds a fact, and create a node only for a fact that is new. Consolidate duplicates, remove what is obsolete, and keep it organized by topic."

/** What one arrival says for itself: who this conversation is, and the one
 *  extra order a moved conversation is given. Everything else in the lines is
 *  the same words in the same order. */
interface Words {
  /** The first line, up to the charter: the one that names the node. */
  readonly who: (agent: NodeAgent) => string
  /** The reconcile order, or `null` for an arrival that has nothing to bring. */
  readonly reconcile: string | null
}

/**
 * The two contracts, as the clauses they differ in.
 *
 * A RECORD OVER THE CLOSED UNION rather than a ternary per line, which is this
 * repo's own shape for exactly this (`@olai/web`'s `roster.ts` `LOOK`): a third
 * arrival fails to compile here, where a ternary would quietly keep saying
 * `opened`'s words. It is also what makes the SHAPE of the teaching visible —
 * `[olai] ` lines and the law — instead of that shape being spelled once per
 * branch.
 */
const SAYS: Record<Arrival, Words> = {
  opened: {
    who: (agent) =>
      `This conversation is the node agent for “${agent.title}” — the node \`${agent.id}\` in \`${agent.file}\`.`,
    reconcile: null,
  },
  assigned: {
    who: (agent) =>
      `This conversation has been ASSIGNED to the node agent “${agent.title}” — the node \`${agent.id}\` in \`${agent.file}\`. It was an ordinary chat until now; from here it is that node's current session.`,
    reconcile:
      "Reconcile first: distill what is still relevant from this conversation into the subtree, updating the entries that already hold it.",
  },
}
