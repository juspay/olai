import { createPreviews } from "./previews.ts"
import type { OpFailure } from "@olai/format"
import { createMessageMemory } from "./message-draft.ts"
import { createHoldingMemory } from "./holding.ts"
import type { Asked } from "./attention/asked.ts"
import { createContext, createSignal, onCleanup, useContext, type Accessor } from "solid-js"
import { createArmed } from "./armed.ts"
import { createDrafts } from "./drafts.ts"
import { createFolds } from "./folds.ts"
import { createPreviewing } from "./previewing.ts"

/** A shared UI reads the live owner's value directly. Multiple page copies
 * may bind the same conversation; releasing one leaves the others intact. */
const liveReading = <T,>(empty: T) => {
  const [owners, setOwners] = createSignal<ReadonlyArray<Accessor<T>>>([])
  return {
    value: () => owners().at(-1)?.() ?? empty,
    bind: (read: Accessor<T>) => {
      setOwners(before => [...before, read])
      onCleanup(() => setOwners(before => before.filter(one => one !== read)))
    },
  }
}

export const createConversationUI = (previews = createPreviews()) => ({
  previews, uploadScope: liveReading<string | null>(null),
  refused: createSignal<OpFailure | null>(null), starting: createSignal(0), pendingSends: createSignal(0),
  messages: createMessageMemory(), holding: createHoldingMemory(), armed: createArmed(), drafts: createDrafts(), folds: createFolds(), previewing: createPreviewing(), reveal: createSignal(false), question: liveReading<Asked | undefined>(undefined),
})
export type ConversationUI = ReturnType<typeof createConversationUI>
const Context = createContext<ConversationUI>()
export const ConversationUIProvider = Context.Provider
export const useConversationUI = () => {
  const ui = useContext(Context)
  if (ui === undefined) throw new Error("conversation UI outside its owner")
  return ui
}
