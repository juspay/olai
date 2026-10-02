import { createSignal, onCleanup } from "solid-js"
import { runAsync } from "@olai/web/client/run.ts"
import { atNode } from "olai-plugin-navigation/routes"
import { navigation } from "../navigation.ts"
import { focusedNode } from "../references.ts"
import { pageReadings } from "../pages.ts"
import { chatWire } from "../wire.ts"
import { newChatRoute } from "./new-chat-route.ts"
import { newChatTitle } from "../../new-chat-title.ts"
import type { Conversing } from "../../sessions.ts"

export interface LocationNode { readonly id: string; readonly title: string; readonly file: string; readonly path: readonly string[]; readonly parent: string | null }
export type ChatLocation = { readonly kind: "default" } | { readonly kind: "under" | "on"; readonly node: LocationNode }
export interface Arrival { readonly engine: string; readonly text: string; readonly later: string; readonly to: Conversing | null; readonly refusal: string | null; readonly done: () => void }

/** Both doors and every mounted face share this activation's draft and permit.
 * Leaving a face releases its queries, never the unsent words. */
export const createNewChat = () => {
  const [pending, setPending] = createSignal(false)
  const [failure, fail] = createSignal<string | null>(null)
  const [draft, setDraft] = createSignal("")
  const [location, choose] = createSignal<ChatLocation>({ kind: "default" })
  const [here, setHere] = createSignal<string | null>(null)
  const [chosen, chooseEngine] = createSignal<string>()
  const arrivals = new Map<string, Arrival>()
  let alive = true
  onCleanup(() => { alive = false; for (const arrival of arrivals.values()) arrival.done(); arrivals.clear() })
  const origin = () => {
    const nav = navigation()
    const page = nav === undefined ? undefined : pageReadings()?.at(nav.workspace().focus)?.shows
    return focusedNode() ?? (page?.kind === "node" && page.zoomed.kind === "node" ? page.zoomed.shows.node.id : null)
  }
  const open = async (message?: string) => {
    const nav = navigation()
    if (!alive || nav === undefined) return "Chat isn't available"
    const from = origin()
    if (newChatRoute.value(nav.route()) === null) setHere(from)
    if (message !== undefined) {
      if (pending()) return "A new chat is already starting"
      setDraft(now => now === "" ? message : `${now}\n${message}`)
      choose({ kind: "default" })
      if (from !== null) {
        const result = await runAsync(chatWire().procedures.conversation.locations())
        if (!alive || navigation() !== nav) return "Chat isn't available"
        if (result._tag === "Success") {
          const node = result.success.find(node => node.id === from)
          if (node !== undefined) choose({ kind: "under", node })
        }
      }
    }
    nav.go(newChatRoute.to(true))
    return null
  }
  const start = async (agent: string) => {
    if (!alive) return
    if (pending()) { fail("A new chat is already starting"); return }
    const text = draft()
    if (text.trim() === "") return
    const where = location()
    const nav = navigation()
    if (nav === undefined) { fail("Navigation is unavailable"); return }
    setPending(true); fail(null); setDraft("")
    let handed = false
    const restore = () => setDraft(now => now === "" ? text : `${text}\n${now}`)
    try {
      const result = where.kind === "on"
        ? await runAsync(chatWire().procedures.conversation.startAgentSession({ node: where.node.id, agent, plain: true }))
        : await runAsync(chatWire().procedures.conversation.newChat({ agent, title: newChatTitle(text), parent: where.kind === "default" ? null : where.node.id }))
      if (!alive) return
      if (result._tag === "Failure") { restore(); fail(result.failure.message); return }
      const value = result.success
      const created = value !== null && "node" in value ? value : null
      const node = where.kind === "on" ? where.node.id : created!.node
      const to = created !== null ? created.to : value as Conversing | null
      const later = draft()
      setDraft("")
      handed = true
      arrivals.set(node, { engine: agent, text, later, to, refusal: created?.refusal ?? null, done: () => { if (alive) setPending(false) } })
      // A replaced navigation provider is not the one this gesture opened in.
      if (navigation() !== nav) { arrivals.delete(node); setDraft(later); restore(); fail("Navigation changed. Try again."); handed = false; return }
      nav.go(atNode(node))
      choose({ kind: "default" })
    } finally { if (!handed) setPending(false) }
  }
  return { pending, failure, draft, setDraft, location, choose, here, chosen, chooseEngine, open, start,
    origin, take: (node: string) => { const value = arrivals.get(node); arrivals.delete(node); return value } }
}
