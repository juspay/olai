import { Result } from "effect"
import type { OpFailure } from "@olai/format"

import { runAsync } from "@olai/web/client/run.ts"
import type { Conversing } from "../../sessions.ts"
import { chatWire } from "../wire.ts"
import { agentReadings } from "./reading.ts"

export const freshStartQuestion = (title: string): string =>
  `Start a fresh chat for “${title}”? The current chat moves to earlier chats.`

export const startFreshChat = async (
  node: string,
  engine: string,
  resumeTo: () => Conversing | null,
): Promise<OpFailure | null> => {
  const reading = agentReadings()
  reading?.visit(node)
  const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine }))
  const mine = agentReadings() === reading
  if (Result.isFailure(outcome)) {
    const previous = mine ? resumeTo() : null
    if (previous !== null) reading?.resume(node, previous)
    return outcome.failure
  }
  if (mine) reading?.visit(node)
  return null
}
