import { createSignal, onCleanup } from "solid-js"
import { runAsync } from "@olai/web/client/run.ts"
import { atNode } from "olai-plugin-navigation/routes"
import { navigation } from "../navigation.ts"
import { focusedNode } from "../references.ts"
import { pageReadings } from "../pages.ts"
import { chatWire } from "../wire.ts"
import { newChatRoute } from "./new-chat-route.ts"
import { createHandoff } from "./handoff.ts"
import { seat } from "./destination.ts"
import type { Conversing } from "../../sessions.ts"

export interface LocationNode { readonly id: string; readonly title: string; readonly file: string; readonly path: readonly string[]; readonly parent: string | null }
export type ChatLocation = { readonly kind: "default" } | { readonly kind: "under" | "on"; readonly node: LocationNode }

/** Both doors and every mounted face share this activation's draft and permit:
 * what a person is writing, where it will go, and the one send in flight. The
 * words a send hands over are the {@link createHandoff} owner's.
 * Leaving a face releases its queries, never the unsent words. */
export const createNewChat = (keep: (to: Conversing, text: string) => void) => {
  const [pending, setPending] = createSignal(false)
  const [failure, fail] = createSignal<string | null>(null)
  const [draft, setDraft] = createSignal("")
  const [location, choose] = createSignal<ChatLocation>({ kind: "default" })
  const [here, setHere] = createSignal<string | null>(null)
  const [chosen, chooseEngine] = createSignal<string>()
  const [focusRequest, requestFocus] = createSignal(0)
  let alive = true
  onCleanup(() => { alive = false })
  /** The words come back in front of whatever is there — a refused send's
   * restore and an unclaimed arrival's reclaim are the same fact. */
  const redraft = (words: string) => setDraft(now => now === "" ? words : `${words}\n${now}`)
  const handoff = createHandoff({ keep, redraft })
  const origin = () => {
    const nav = navigation()
    if (nav !== undefined && newChatRoute.value(nav.route()) !== null) return null
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
      if (from !== null) {
        const result = await runAsync(chatWire().procedures.conversation.locations({ filter: "", limit: 0, ids: [from], parents: [] }))
        if (!alive || navigation() !== nav) return "Chat isn't available"
        if (result._tag === "Success") {
          const node = result.success.nodes.find(node => node.id === from)
          if (node !== undefined) choose({ kind: "under", node })
        }
      }
    }
    nav.go(newChatRoute.to(true))
    requestFocus(value => value + 1)
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
    const leave = handoff.gesture(nav)
    setPending(true); fail(null); setDraft("")
    let handed = false
    try {
      const result = await seat(where, agent, text)
      if (!alive) return
      if (result._tag === "Failure") { redraft(text); fail(result.failure.message); return }
      const { node, to, refusal } = result.success
      const later = draft()
      setDraft("")
      handed = true
      handoff.record(node, { engine: agent, text, later, to, refusal, done: () => { if (alive) setPending(false) } })
      // A replaced navigation provider is not the one this gesture opened in.
      const route = nav.route()
      const atDestination = route.kind === "at" && route.address?.kind === "node" && route.address.id === node
      if (navigation() !== nav || leave.departed() && !atDestination) { handoff.reclaim(node); return }
      fail(null)
      nav.go(atNode(node))
      handoff.announce()
      choose({ kind: "default" })
    } finally { leave.settle(); if (!handed) setPending(false) }
  }
  return { focusRequest, pending, failure, draft, setDraft, location, choose, here, chosen, chooseEngine, open, start,
    origin, take: handoff.take }
}
