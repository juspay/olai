import { type AgentItem } from "@olai/format"
import { createSignal, onCleanup } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { chatWire } from "../wire.ts"
import type { Conversing } from "../../sessions.ts"

/**
 * ONE AT A TIME — a permit that is either free or held by one creation. `take`
 * answers the release, or `null` while it is held; releasing twice is
 * releasing once.
 */
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

/**
 * THE ONE NEW CHAT IN FLIGHT, for this browser activation — shared by every
 * way of starting one: the `+` beside **Chats**, the palette's *New chat*,
 * the line at the top of a note, a chat page's own box.
 *
 * The palette refuses a second submit at the same level; this permit is what
 * refuses one from a level opened again while the first is still answering.
 */
export const createNewChat = () => {
  const permit = createPermit()
  /** What the `+` beside Chats could not do, said under that heading. */
  const [said, say] = createSignal<Said>()
  let alive = true
  onCleanup(() => { alive = false })
  /**
   * THE CHAT OF AN ITEM: the chat of the node or note `item`, started on
   * `engine` with `text` as its first message — which the SERVER delivers,
   * once, because there is no second place here for the words to wait.
   * Answers the chat, or the sentence that says why there is none; a start or
   * a send the agent refused is the chat AND its sentence, since the chat
   * exists.
   */
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
