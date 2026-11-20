import { useShown } from "olai-plugin-navigation/routing"
import type { Accessor } from "solid-js"
import { agentReadings } from "./reading.ts"
import { createConversation } from "./conversation-reading.ts"

export const createNodeConversation = (node: Accessor<string>) =>
  createConversation(agentReadings(), node, useShown())
