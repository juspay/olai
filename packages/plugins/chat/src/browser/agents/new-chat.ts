import { createSignal, onCleanup } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { navigation } from "../navigation.ts"
import { chatWire } from "../wire.ts"
import { newChatTitle } from "../../new-chat-title.ts"
import { createHandoff } from "./handoff.ts"
import type { Conversing } from "../../sessions.ts"

/**
 * ONE AT A TIME — a permit that is either free or held by one creation. `take`
 * answers the release, or `null` while it is held; releasing twice is
 * releasing once, so whichever of the sender and the hand-off lets go first
 * frees it.
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
 * way of submitting one (the palette's message level, however it was opened).
 * The palette refuses a second submit at the same level; this permit is what
 * refuses one from a level opened again while the first is still answering.
 *
 * The words a send hands over are the {@link createHandoff} owner's: the new
 * node's page claims them, and anything that keeps that page from being
 * reached gives them back.
 */
export const createNewChat = (keep: (to: Conversing, text: string) => void) => {
  const permit = createPermit()
  /** What the `+` beside Chats could not do, said under that heading. */
  const [said, say] = createSignal<Said>()
  let alive = true
  onCleanup(() => { alive = false })
  const handoff = createHandoff({ keep })
  /**
   * Mint a chat under `parent` (`null`: the Inbox's Chats container) and start
   * `engine` on it, then give the hand-off the first message to land. Answers
   * a sentence when nothing was created, so the person's words stay where they
   * typed them; `null` once a node exists, whatever its start said.
   *
   * The permit is held from here until the new page has taken the message, or
   * until the call answers with nothing to hand over. Where the message goes
   * once a node exists is the hand-off's, and `signal` (the asking level's) is
   * what it reads to know whether anyone is still looking.
   */
  const start = async (parent: string | null, engine: string, text: string, signal: AbortSignal): Promise<string | null> => {
    const nav = navigation()
    if (!alive || nav === undefined) return "Chat isn't available"
    const release = permit.take()
    if (release === null) return "A new chat is already starting"
    let handed = false
    try {
      const result = await runAsync(chatWire().procedures.conversation.newChat({ agent: engine, title: newChatTitle(text), parent }))
      if (!alive) return "Chat isn't available"
      if (result._tag === "Failure") return result.failure.message
      const { node, to, refusal } = result.success
      handed = true
      handoff.land(node, { engine, text, to, refusal, done: release }, { nav, signal })
      return null
    } finally { if (!handed) release() }
  }
  return { pending: permit.held, said, say, start, take: handoff.take }
}
