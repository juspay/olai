import { type AgentItem } from "@olai/format"
import { createSignal, onCleanup } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { chatWire } from "../wire.ts"
import type { Conversing } from "../../sessions.ts"

const createPermit = () => {
  const [held, setHeld] = createSignal(false)
  const take = (): (() => void) | null => {
    if (held()) return null
    setHeld(true)
    let released = false
    return () => { if (!released) { released = true; setHeld(false) } }
  }
  return { held, take }
}

export interface NewChatOwner {
  readonly pending: () => boolean
  readonly said: () => Said | undefined
  readonly say: (said: Said | undefined) => void
  readonly about: (input: { readonly item: AgentItem; readonly engine: string; readonly text: string }) =>
    Promise<{ readonly node: string; readonly to: Conversing | null; readonly refusal: string | null } | string>
}

export const createNewChat = (): NewChatOwner => {
  const permit = createPermit()
  const [said, say] = createSignal<Said>()
  let alive = true
  onCleanup(() => { alive = false })
  const about = async (input: { readonly item: AgentItem; readonly engine: string; readonly text: string }):
    Promise<{ readonly node: string; readonly to: Conversing | null; readonly refusal: string | null } | string> => {
    if (!alive) return "Chat isn't available"
    const release = permit.take()
    if (release === null) return "A new chat is already starting"
    try {
      const result = await runAsync(chatWire().procedures.conversation.newChat({ agent: input.engine, item: input.item, say: input.text }))
      if (!alive) return "Chat isn't available"
      if (result._tag === "Failure") return result.failure.message
      return result.success
    } finally { release() }
  }
  return { pending: permit.held, said, say, about }
}
