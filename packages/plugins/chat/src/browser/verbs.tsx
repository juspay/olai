import type { RowAction, RowVerb } from "olai-plugin-outlines/slots"
import { Result } from "effect"
import { runAsync } from "@olai/web/client/run.ts"
import type { Roster } from "./agents/answered.tsx"
import { holdsSlot, type Row } from "./agents/roster.ts"
import { agentReadings } from "./agents/reading.ts"
import { fold, unfold } from "./agents/folding.ts"
import { chatWire } from "./wire.ts"

import { freshStartQuestion } from "./agents/fresh-start.ts"
import { CLOSE_CHAT, closeMade } from "./agents/closing.ts"

export const rowVerbs = (
  node: string,
  roster: Roster,
  above?: (node: string) => Row | undefined,
  open?: (row: Row) => string | void,
): ReadonlyArray<RowAction> => {
  const openAbove: RowAction | undefined = (() => {
    if (above?.(node) === undefined) return undefined
    return {
      id: "open-agent-above", label: "Open the agent above", writes: false,
      run: (node: string) => {
        const row = above?.(node)
        if (row === undefined) return
        return open === undefined ? "Can't open this right now" : open(row)
      },
    }
  })()
  const bound = roster.at(node)
  const startOn = (engine: { readonly id: string }) => async (drawn: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine.id }))
    if (Result.isFailure(outcome)) return outcome.failure.message
    agentReadings()?.visit(node)
    unfold(drawn)
  }
  if (bound?.session == null) {
    const engines = bound?.engine != null
      ? roster.engines().filter(engine => engine.id === bound.engine) : roster.engines()
    return [{
      id: "start-agent", label: "Start an agent", writes: true,
      choices: engines.map(engine => ({ id: `start-agent-${engine.id}`, label: engine.name, writes: true, run: startOn(engine) })),
    }, ...(openAbove === undefined ? [] : [openAbove])]
  }
  const available = roster.engines()
  const current = available.find(engine => engine.id === bound.engine)
  const engines = current === undefined ? available : [current, ...available.filter(engine => engine !== current)]
  return [
    ...(openAbove === undefined ? [] : [openAbove]),
    {
      id: "fresh-start", label: "Fresh start", writes: true,
      choices: engines.map(engine => ({
        id: `fresh-start-${engine.id}`, label: engine.name, writes: true,
        confirm: freshStartQuestion(roster.named(bound).name), run: startOn(engine),
      })),
    },
    {
      id: "sleep-when-idle", writes: true,
      label: bound.sleeps ? "Stop sleeping when idle" : "Sleep when idle",
      run: async () => {
        const outcome = await runAsync(
          chatWire().procedures.conversation.setSleeping({ node, on: !bound.sleeps }),
        )
        if (Result.isFailure(outcome)) return outcome.failure.message
      },
    },
    ...chatVerbs(bound),
  ]
}

const PUT_TO_SLEEP: RowVerb = {
  id: "put-to-sleep", writes: false, label: "Put to sleep",
  run: async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.sleep({ node }))
    if (Result.isFailure(outcome)) return outcome.failure.message
  },
}

const TIDY_MEMORY: RowVerb = {
  id: "tidy-memory", writes: true, label: "Tidy memory",
  run: async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.tidyMemory({ node }))
    if (Result.isFailure(outcome)) return outcome.failure.message
    return outcome.success._tag === "Refused" ? outcome.success.said : undefined
  },
}

const CLOSE_AGENT: RowVerb = {
  id: "close-agent", writes: true, label: CLOSE_CHAT,
  run: async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.closeAgent({ node }))
    if (Result.isFailure(outcome)) return outcome.failure.message
    fold(node)
    closeMade(node)
  },
}

const HOLDING_A_SLOT: ReadonlyArray<RowVerb> = [PUT_TO_SLEEP, TIDY_MEMORY, CLOSE_AGENT]
const SLOTLESS: ReadonlyArray<RowVerb> = [TIDY_MEMORY, CLOSE_AGENT]
const NOTE_HOLDING_A_SLOT: ReadonlyArray<RowVerb> = [PUT_TO_SLEEP, CLOSE_AGENT]
const NOTE_SLOTLESS: ReadonlyArray<RowVerb> = [CLOSE_AGENT]
const NO_CHAT: ReadonlyArray<RowVerb> = []

export const chatVerbs = (bound: Row): ReadonlyArray<RowVerb> =>
  bound.session == null
    ? NO_CHAT
    : bound.kind === "note"
      ? (holdsSlot(bound.standing) ? NOTE_HOLDING_A_SLOT : NOTE_SLOTLESS)
      : (holdsSlot(bound.standing) ? HOLDING_A_SLOT : SLOTLESS)
