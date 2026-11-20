import { memoryOf, type NodeAgent } from "@olai/format"

export const lines = (sentences: ReadonlyArray<string>): ReadonlyArray<string> =>
  sentences.map((sentence) => `[olai] ${sentence}`)

export const teachingFor = (agent: NodeAgent): ReadonlyArray<string> => {
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

const NOTE_WHO = (agent: NodeAgent): string =>
  `This conversation belongs to the note \`${agent.file}\` — “${agent.title}”.`

const NOTE_IS_MEMORY = (agent: NodeAgent): string =>
  `That note IS your memory: read \`${agent.file}\` with markdown_read before every answer, so what you say is what it says now.`

const NOTE_IS_THEIRS =
  "It is the person's note: change it only when they ask you to, and leave the front-matter block at the top of it exactly as it is."

const NOTE_MEMORY_OFF = "You have no memory of your own here: that note is the only memory."

export const REMINDER =
  "Reminder: answer first, and write to this node's subtree only when a durable fact changed — update the node that holds it, add a node only for a fact that is new, and never record messages, questions, your own actions or a running account of the conversation."

export const REMINDING: ReadonlyArray<string> = lines([REMINDER])

export const NOTE_REMINDER =
  "Reminder: read the note again before you answer, and change it only when the person asks."

const NOTE_REMINDING: ReadonlyArray<string> = lines([NOTE_REMINDER])

export const remindingFor = (agent: NodeAgent): ReadonlyArray<string> =>
  agent.kind === "note" ? NOTE_REMINDING : REMINDING

export const HARNESS_MEMORY_OFF =
  "You have no memory of your own here: this subtree is the only memory."

const CHARTER =
  "That node's own note is your charter: where it says otherwise, it overrides everything below."

const TRIGGER = (count: string): string =>
  `That node's SUBTREE is your knowledge base, organized by topic (${count}): read it for what is already known. Answer first, and write to it only when a durable fact changed — a decision, a finding, a ruling or preference of the person, a standing state of the world. Never record messages, questions, your own actions, or a running account of the conversation.`

const SHAPE =
  "One node per fact: update the node that already holds a fact, and create a node only for a fact that is new. Consolidate duplicates, remove what is obsolete, and keep it organized by topic."

const WHO = (agent: NodeAgent): string =>
  `This conversation is the node agent for “${agent.title}” — the node \`${agent.id}\` in \`${agent.file}\`.`
