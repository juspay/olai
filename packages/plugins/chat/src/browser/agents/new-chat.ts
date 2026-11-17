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
  /**
   * THE DOOR ON A PAGE: a chat about the place at `about`, called `name`,
   * started on `engine` with `text` as its first message — which the server
   * delivers, once, because the person stays on the page they asked from and
   * there is no new page here for the words to wait on. Answers the new chat
   * row, or the sentence that says why there is none; a start or a send the
   * agent refused is the row AND its sentence, since the chat exists.
   */
  const about = async (input: { readonly about: string; readonly name: string; readonly engine: string; readonly text: string }):
    Promise<{ readonly node: string; readonly refusal: string | null } | string> => {
    if (!alive) return "Chat isn't available"
    const release = permit.take()
    if (release === null) return "A new chat is already starting"
    try {
      const result = await runAsync(chatWire().procedures.conversation.newChat({
        agent: input.engine, title: input.name, parent: null, about: input.about, say: input.text,
      }))
      if (!alive) return "Chat isn't available"
      if (result._tag === "Failure") return result.failure.message
      return { node: result.success.node, refusal: result.success.refusal }
    } finally { release() }
  }
  return { pending: permit.held, said, say, start, about, take: handoff.take }
}
