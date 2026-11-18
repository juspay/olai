/**
 * WHAT AN AGENT-ASSOCIATED SESSION IS TOLD, ONCE — AND REMINDED OF.
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
 *     MCP servers and nothing else a client may put words in
 *     (`@kolu/acp-client`'s `agent.ts`); there is no field, on either leg. Getting one would mean
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
 * So every Nth message a person sends a node agent carries {@link REMINDING}: the write
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
 * handed (`@kolu/acp-client`'s `servers.ts`), and an instruction naming a call the session
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

/** THE ONE PLACE `[olai] ` IS SPELLED: sentences in, the lines that ride under
 *  a message out. The teaching and the reminder both go through it, so the
 *  seam has one shape however many things ride it.
 *
 *  EXPORTED, for the one rider that is nobody here's: a row that opened a
 *  conversation through core's `conversations` key (`@olai/plugin-api`'s
 *  `Conversations`) hands over SENTENCES, and they go under the first message
 *  beside the contract this file writes. A second spelling of the prefix, in
 *  the module that took that row's words, would be an agent told two different
 *  things about which lines are olai's — so the preamble comes through here or
 *  it does not ride at all. */
export const lines = (sentences: ReadonlyArray<string>): ReadonlyArray<string> =>
  sentences.map((sentence) => `[olai] ${sentence}`)

/**
 * WHAT THE AGENT IS TOLD, as the lines {@link ./prompt.ts}'s `annotated` puts
 * under a message — one line per thing, in priority order.
 *
 * WHO FIRST, AND THE CHARTER WITH IT: which node, and that its note outranks
 * every default below. Then THE LAW — when to write, then in what shape — and
 * last the line about the engine's own memory.
 *
 * AN EMPTY SUBTREE IS SAID rather than skipped, and it is the case a fresh node
 * agent is actually in: "nothing under it yet" tells it there is nothing to
 * read, where a line claiming a knowledge base of zero rows would read as one
 * that failed to load.
 *
 * ## AND A NOTE IS TOLD A DIFFERENT CONTRACT, which is the branch below
 *
 * The law above is about a SUBTREE — when to write to it, in what shape — and
 * a note has none: the file itself is the memory. So a note's agent is told
 * four things and not five, and the two that differ are the two that matter:
 * READ the note before every answer, because it is what the conversation
 * knows; and change it only when the person asks, because it is their file and
 * not a place to take notes in. The front-matter block is named as off limits
 * for the same reason the write fence refuses it — the keys at the top are
 * what seat the chat, and an agent rewriting them would be seating itself.
 */
export const teachingFor = (agent: NodeAgent): ReadonlyArray<string> => {
  // A NOTE'S CONTRACT IS ITS OWN, and shorter by three lines: there is no
  // subtree to write into, so none of the law about WHEN to write and in what
  // SHAPE applies. What is left is the whole of the arrangement — which note
  // this is, that it is the memory, that it is read before every answer, and
  // that it changes only when the person asks.
  if (agent.kind === "note") {
    return lines([
      NOTE_WHO(agent),
      NOTE_IS_MEMORY(agent),
      NOTE_IS_THEIRS,
      NOTE_MEMORY_OFF,
    ])
  }
  return lines([
    `${WHO(agent)} ${CHARTER}`,
    TRIGGER(agent.memory === 0 ? "nothing under it yet" : memoryOf(agent)),
    SHAPE,
    HARNESS_MEMORY_OFF,
  ])
}

/** WHOSE NOTE THIS CONVERSATION IS — the first line of a note's contract. */
const NOTE_WHO = (agent: NodeAgent): string =>
  `This conversation belongs to the note \`${agent.file}\` — “${agent.title}”.`

/** ...AND WHAT THE NOTE IS: the memory, read every time rather than
 *  remembered. The path rides the sentence because the tool call needs it and
 *  an agent that had to derive it from the line above would derive it once and
 *  then trust its own copy. */
const NOTE_IS_MEMORY = (agent: NodeAgent): string =>
  `That note IS your memory: read \`${agent.file}\` with markdown_read before every answer, so what you say is what it says now.`

/** ...AND WHOSE IT IS, which is the clause that keeps a note a person's own
 *  file. The front-matter block is olai's bookkeeping — the tie and the switch
 *  that says where the chat opens — and an agent rewriting it would be seating
 *  or unseating itself. */
const NOTE_IS_THEIRS =
  "It is the person's note: change it only when they ask you to, and leave the front-matter block at the top of it exactly as it is."

/** The last line of a note's contract — {@link HARNESS_MEMORY_OFF} said about
 *  the other kind of memory, because the sentence has to name the thing that
 *  IS the memory or it reads as being about nothing. */
const NOTE_MEMORY_OFF = "You have no memory of your own here: that note is the only memory."

/**
 * THE REMINDER — the law in one sentence, for the Nth message after the
 * teaching.
 *
 * ONE SENTENCE: the trigger and the shape, compressed, and nothing about which
 * node — the conversation already knows that, and a reminder that re-told it
 * would be a second preamble. The sentence alone, like every clause above; the
 * `[olai] ` line it rides as is {@link REMINDING}'s, made by the same builder
 * the teaching's lines are.
 */
export const REMINDER =
  "Reminder: answer first, and write to this node's subtree only when a durable fact changed — update the node that holds it, add a node only for a fact that is new, and never record messages, questions, your own actions or a running account of the conversation."

/** ... as the lines {@link ./prompt.ts}'s `annotated` puts under the Nth
 *  message, and the notice a person reads verbatim — one line, on the seam the
 *  teaching rides. */
export const REMINDING: ReadonlyArray<string> = lines([REMINDER])

/**
 * ...AND A NOTE'S REMINDER, which is the other law in one sentence: the note
 * is read again before this answer, and it changes only when asked.
 *
 * A SEPARATE SENTENCE rather than a paraphrase of the one above, for the
 * reason the two contracts are separate: there is no subtree here, so a
 * reminder about writing to one is a reminder about something the agent
 * cannot do, and the thing it CAN forget — that the note has moved since it
 * last read it — would go unsaid.
 */
export const NOTE_REMINDER =
  "Reminder: read the note again before you answer, and change it only when the person asks."

const NOTE_REMINDING: ReadonlyArray<string> = lines([NOTE_REMINDER])

/** WHICH REMINDER THIS CHAT GETS — the one fact the sender has that decides
 *  it, asked here so the two laws cannot be told to the wrong agent. */
export const remindingFor = (agent: NodeAgent): ReadonlyArray<string> =>
  agent.kind === "note" ? NOTE_REMINDING : REMINDING

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

/**
 * WHO THIS CONVERSATION IS — the first line, up to the charter.
 *
 * A node agent's conversation is one olai OPENED for the node: it knows
 * nothing that is not in the subtree, because it has not said anything yet,
 * and there is no second way in for the line to have to spell.
 */
const WHO = (agent: NodeAgent): string =>
  `This conversation is the node agent for “${agent.title}” — the node \`${agent.id}\` in \`${agent.file}\`.`
