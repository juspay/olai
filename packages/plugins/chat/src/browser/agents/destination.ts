/**
 * WHAT A CHOSEN LOCATION MEANS ON THE WIRE — the one place that knows a chat
 * ON a node is a different procedure from one UNDER (or at the default)
 * parent, and the one place that folds both into the single answer the sender
 * needs: the node the words belong to, the conversation that will answer them
 * (`null` when its start was refused), and that refusal.
 */
import { Result } from "effect"
import type { OpFailure } from "@olai/format"
import { runAsync } from "@olai/web/client/run.ts"
import { chatWire } from "../wire.ts"
import { newChatTitle } from "../../new-chat-title.ts"
import type { Conversing } from "../../sessions.ts"
import type { ChatLocation } from "./new-chat.ts"

export interface Seated {
  readonly node: string
  readonly to: Conversing | null
  readonly refusal: string | null
}

export const seat = async (
  where: ChatLocation,
  agent: string,
  text: string,
): Promise<Result.Result<Seated, OpFailure>> => {
  if (where.kind === "on") {
    const started = await runAsync(chatWire().procedures.conversation.startAgentSession({ node: where.node.id, agent, expectPlain: true }))
    return Result.isSuccess(started)
      ? Result.succeed({ node: where.node.id, to: started.success, refusal: null })
      : Result.fail(started.failure)
  }
  return runAsync(chatWire().procedures.conversation.newChat({
    agent, title: newChatTitle(text), parent: where.kind === "default" ? null : where.node.id,
  }))
}
