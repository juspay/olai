/** Static extension contracts owned by the chat capability. */
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
  "conversation.wake": slotContract<(context: WakeContext) => JSX.Element>("conversation.wake", "plugin",
    "A component handed `{ pick, setPick, waiting, conversation }`, drawn as this plugin's control on a conversation's strip; `pick` and `setPick` read and keep the plugin's own choice for that conversation."),
  "tool.reply": slotContract<ToolReplyFace>("tool.reply", "plugin",
    "A `{ fileOf, story }` for replies to this plugin's own tools in a conversation: `fileOf` is handed the reply and answers the file it is about, and `story` is a component handed `{ reply }` that draws it."),
  "delivery.mark": slotContract<() => JSX.Element>("delivery.mark","plugin",
    "A function called with nothing that draws this plugin's mark beside a message it delivered into a conversation."),
} as const

/** The owning plugin draws its reply; chat keeps the frame; the face owns its interactions. */
export interface ToolReplyFace {
  readonly fileOf: (reply: Json) => string | null
  readonly story: (props: { reply: Json }) => JSX.Element | null
}

/** Each plugin owns its pick's meaning and control. Chat owns its persistence. */
export interface WakeContext {
  readonly pick: () => unknown
  readonly setPick: (next: unknown | null) => Effect.Effect<void, Refusal>
  readonly waiting: () => number
  readonly conversation: { readonly agent: string; readonly session: string }
}
