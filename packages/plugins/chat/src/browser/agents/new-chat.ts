import { servedDirectory } from "../vault.ts"
import { createSignal, onCleanup } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { atElement } from "olai-plugin-navigation/routes"
import { navigation as routeReading } from "../navigation.ts"
import { chatWire } from "../wire.ts"
import { unfold } from "./folding.ts"

/** The sidebar and palette share one in-flight creation gesture. Its callback
 * cannot navigate a later activation if the plugin is rebuilt while opening. */
export const createNewChat = () => {
  const [pending, setPending] = createSignal(false)
  const [said, say] = createSignal<Said>()
  let alive = true
  onCleanup(() => { alive = false })
  const start = async (agent: string): Promise<Said | undefined> => {
    if (!alive) return { tone: "alarm", text: "chat is unavailable" }
    if (pending()) return { tone: "aside", text: "a new conversation is already starting" }
    setPending(true)
    say(undefined)
    try {
      const result = await runAsync(chatWire().procedures.conversation.newChat({ agent }))
      if (!alive) return
      if (result._tag === "Failure") { const failure: Said = { tone: "alarm", text: result.failure.message, kind: result.failure._tag }; say(failure); return failure }
      // Ask the existing node lookup for its current file. This also reports a
      // concurrent removal instead of waiting indefinitely for a roster row.
      const found = await runAsync(chatWire().procedures.conversation.agentAbove({ node: result.success }))
      if (!alive) return
      if (found._tag === "Failure") { const failure: Said = { tone: "alarm", text: found.failure.message, kind: found.failure._tag }; say(failure); return failure }
      const row = found.success
      const nav = routeReading()
      const claims = servedDirectory()?.claims()
      if (row === null || row.node !== result.success || nav === undefined || claims === undefined) {
        const failure: Said = { tone: "alarm", text: "the conversation was created, but its node is no longer available here" }
        say(failure); return failure
      }
      nav.go(atElement(claims, row.file, row.node))
      unfold(row.node)
    } finally { setPending(false) }
  }
  return { pending, said, start }
}
