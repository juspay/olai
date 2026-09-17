import { createPreviews } from "./previews.ts"
import type { OpFailure } from "@olai/format"
import { createMessageMemory } from "./message-draft.ts"
import { createHoldingMemory } from "./holding.ts"
import type { Asked } from "./attention/asked.ts"
import { createContext, createSignal, useContext } from "solid-js"
import { createArmed } from "./armed.ts"
import { createDrafts } from "./drafts.ts"
import { createFolds } from "./folds.ts"
import { createPreviewing } from "./previewing.ts"

export const createConversationUI = (previews = createPreviews()) => ({
  previews, uploadScope: createSignal<string | null>(null),
  refused: createSignal<OpFailure | null>(null), starting: createSignal(0), pendingSends: createSignal(0),
  messages: createMessageMemory(), holding: createHoldingMemory(), armed: createArmed(), drafts: createDrafts(), folds: createFolds(), previewing: createPreviewing(), reveal: createSignal(false), question: createSignal<Asked>(),
})
export type ConversationUI = ReturnType<typeof createConversationUI>
const Context = createContext<ConversationUI>()
export const ConversationUIProvider = Context.Provider
export const useConversationUI = () => {
  const ui = useContext(Context)
  if (ui === undefined) throw new Error("conversation UI outside its owner")
  return ui
}
