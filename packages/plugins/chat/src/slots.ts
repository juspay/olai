/** Static extension contracts owned by the chat capability. */
import type { Json } from "./json.ts"
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"
import type { NotHere } from "@olai/plugin-api"



declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "tool.reply": SlotDefinition<ToolReplyFace, "plugin">
    "delivery.mark": SlotDefinition<() => JSX.Element, "plugin">
    "engine.install": SlotDefinition<NotHere, "plugin">
  }
}

export const slotContracts = {
  "tool.reply": slotContract<ToolReplyFace>("tool.reply", "plugin"),
  "delivery.mark": slotContract<() => JSX.Element>("delivery.mark","plugin"),
  "engine.install": slotContract<NotHere>("engine.install","plugin"),
} as const

/** The owning plugin draws its reply; chat keeps the frame; the face owns its interactions. */
export interface ToolReplyFace {
  readonly fileOf: (reply: Json) => string | null
  readonly story: (props: { reply: Json }) => JSX.Element | null
}
