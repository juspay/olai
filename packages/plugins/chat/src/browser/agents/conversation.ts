import { useShown } from "olai-plugin-navigation/routing"
import type { Accessor } from "solid-js"
import { agentReadings } from "./reading.ts"
import { createConversation } from "./conversation-reading.ts"

/** The page acquires from the declared chat activation; its owner releases
 * the lease, while retained drafts remain with that activation. */
export const createNodeConversation = (node: Accessor<string>) =>
  createConversation(agentReadings(), node, useShown())
