/** ONE FRESH START, however it was pressed — the shared copy and the shared
 *  gesture.
 *
 *  Two faces ask for one: the agent line's *Fresh start*, with its engine menu
 *  and its confirmation, and the refused-chat body's *Start fresh chat*, which
 *  is one press and no question ({@link ../chat/Unopened.tsx}). What differs is
 *  everything BEFORE the request — which engine, and whether anything is asked
 *  first. What must not differ is what happens after it, and it did: the body's
 *  copy did not return the reader to the conversation a refused start left it
 *  in, so a refused press kept one face on screen while the slot held a
 *  different refusal, and *Try again* under it retried something else. */

import { Result } from "effect"
import type { OpFailure } from "@olai/format"

import { runAsync } from "@olai/web/client/run.ts"
import type { Conversing } from "../../sessions.ts"
import { chatWire } from "../wire.ts"
import { agentReadings } from "./reading.ts"

/** Shared copy for the agent line and the outline row's confirmation. */
export const freshStartQuestion = (title: string): string =>
  `Start a fresh chat for “${title}”? The current chat moves to earlier chats.`

/**
 * START ONE, and leave the reader where the outcome says it belongs.
 *
 * The reader follows the node's LIVE binding from the press: whatever history
 * visit was on screen is not where the new conversation is going to be. On a
 * refusal it goes back to `resumeTo()` — read AFTER the round trip, because
 * what it answers is "is the node still bound to what it was bound to when I
 * pressed", and only the answer to that makes resuming honest. A `null` there
 * leaves the node address, which is the face for a node with no conversation.
 *
 * Auth-required is NOT a failure here: it returns successfully with no binding
 * and keeps the node-scoped panel available for the sign-in the caller's
 * success arm leaves on screen.
 *
 * Answers the refusal, or `null`. The caller says it: the agent line has a
 * said-line, the refused-chat body has the refusal line it already draws for a
 * refused *Try again*, and neither is this module's to pick.
 */
export const startFreshChat = async (
  node: string,
  engine: string,
  resumeTo: () => Conversing | null,
): Promise<OpFailure | null> => {
  const reading = agentReadings()
  reading?.visit(node)
  const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine }))
  // A chat activation that was replaced while this was in flight owns none of
  // the readers this would move.
  const mine = agentReadings() === reading
  if (Result.isFailure(outcome)) {
    const previous = mine ? resumeTo() : null
    if (previous !== null) reading?.resume(node, previous)
    return outcome.failure
  }
  if (mine) reading?.visit(node)
  return null
}
