import { createSignal, onCleanup } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { atNode } from "olai-plugin-navigation/routes"
import { navigation } from "../navigation.ts"
import { chatWire } from "../wire.ts"
import { newChatTitle } from "../../new-chat-title.ts"
import { createHandoff } from "./handoff.ts"
import type { Conversing } from "../../sessions.ts"

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
  const [pending, setPending] = createSignal(false)
  /** What the `+` beside Chats could not do, said under that heading. */
  const [said, say] = createSignal<Said>()
  let alive = true
  onCleanup(() => { alive = false })
  const handoff = createHandoff({ keep })
  /**
   * Mint a chat under `parent` (`null`: the Inbox's Chats container), start
   * `engine` on it and land on its page with `text` as its first message.
   * Answers a sentence when nothing was created, so the person's words stay
   * where they typed them; `null` once a node exists, whatever its start said.
   *
   * `signal` is the asking level's: once it is aborted nobody is looking, so
   * nothing navigates and the words go back to the conversation (or the
   * plain node) as an unsent draft.
   */
  const start = async (parent: string | null, engine: string, text: string, signal: AbortSignal): Promise<string | null> => {
    const nav = navigation()
    if (!alive || nav === undefined) return "Chat isn't available"
    if (pending()) return "A new chat is already starting"
    setPending(true)
    let handed = false
    try {
      const result = await runAsync(chatWire().procedures.conversation.newChat({ agent: engine, title: newChatTitle(text), parent }))
      if (!alive) return "Chat isn't available"
      if (result._tag === "Failure") return result.failure.message
      const { node, to, refusal } = result.success
      handed = true
      handoff.record(node, { engine, text, to, refusal, done: () => { if (alive) setPending(false) } })
      // A replaced navigation provider is not the one this level opened in.
      if (signal.aborted || navigation() !== nav) { handoff.reclaim(node); return null }
      nav.go(atNode(node))
      handoff.announce()
      return null
    } finally { if (!handed) setPending(false) }
  }
  return { pending, said, say, start, take: handoff.take }
}
