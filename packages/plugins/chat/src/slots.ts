import type { Effect } from "effect"
export interface Refusal { readonly reason: string }
import type { Json } from "./json.ts"
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "conversation.wake": SlotDefinition<(context: WakeContext) => JSX.Element, "plugin">
    "tool.reply": SlotDefinition<ToolReplyFace, "plugin">
    "delivery.mark": SlotDefinition<() => JSX.Element, "plugin">
  }
}

export const slotContracts = {
  "conversation.wake": slotContract<(context: WakeContext) => JSX.Element>("conversation.wake", "plugin"),
  "tool.reply": slotContract<ToolReplyFace>("tool.reply", "plugin"),
  "delivery.mark": slotContract<() => JSX.Element>("delivery.mark","plugin"),
} as const

export interface ToolReplyFace {
  readonly fileOf: (reply: Json) => string | null
  readonly story: (props: { reply: Json }) => JSX.Element | null
}

export interface WakeContext {
  readonly pick: () => unknown
  readonly setPick: (next: unknown | null) => Effect.Effect<void, Refusal>
  readonly waiting: () => number
  readonly conversation: { readonly agent: string; readonly session: string }
}
