import { createSignal, createEffect, createRoot, untrack, onCleanup } from "solid-js"
import { isPutAway } from "@olai/format"
import { servedDirectory } from "../vault.ts"
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
export const createNewChat = (keep: (to: Conversing, text: string) => void) => {
  const [pending, setPending] = createSignal(false)
  const [failure, fail] = createSignal<string | null>(null)
  const [draft, setDraft] = createSignal("")
  const [location, choose] = createSignal<ChatLocation>({ kind: "default" })
  const [here, setHere] = createSignal<string | null>(null)
  const [chosen, chooseEngine] = createSignal<string>()
  const [focusRequest, requestFocus] = createSignal(0)
  const arrivals = new Map<string, Arrival>()
  const [revision, revise] = createSignal(0)
  const publish = () => revise(value => value + 1)
  const reclaim = (node: string, arrival: Arrival) => {
    arrivals.delete(node)
    const words = arrival.later === "" ? arrival.text : `${arrival.text}\n${arrival.later}`
    if (arrival.to === null) setDraft(now => now === "" ? words : `${words}\n${now}`)
    else keep(arrival.to, words)
    arrival.done()
    publish()
  }
  createEffect(() => {
    revision()
    const nav = navigation()
    const route = nav?.route()
    const shows = nav === undefined ? undefined : pageReadings()?.at(nav.workspace().focus)?.shows
    const claims = servedDirectory()?.claims()
    const unavailable = shows?.kind === "node" && (shows.zoomed.kind !== "node" || claims !== undefined && isPutAway(claims, shows.zoomed.shows.file))
    untrack(() => {
      for (const [node, arrival] of arrivals) {
        if (route?.kind !== "at" || route.address?.kind !== "node" || route.address.id !== node || unavailable) reclaim(node, arrival)
      }
    })
  })
  const watches = new Set<() => void>()
  let alive = true
  onCleanup(() => { alive = false; for (const stop of watches) stop(); watches.clear(); for (const [node, arrival] of arrivals) reclaim(node, arrival) })
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
    const startedAt = nav.route()
    let departed = false
    const stopWatch = createRoot(dispose => {
      createEffect(() => { if (!nav.routes.samePage(nav.route(), startedAt)) departed = true })
      return dispose
    })
    watches.add(stopWatch)
    setPending(true); fail(null); setDraft("")
    let handed = false
    const restore = () => setDraft(now => now === "" ? text : `${text}\n${now}`)
    try {
      let value: { node: string; to: Conversing | null; refusal: string | null }
      if (where.kind === "on") {
        const result = await runAsync(chatWire().procedures.conversation.startAgentSession({ node: where.node.id, agent, expectPlain: true }))
        if (!alive) return
        if (result._tag === "Failure") { restore(); fail(result.failure.message); return }
        value = { node: where.node.id, to: result.success, refusal: null }
      } else {
        const result = await runAsync(chatWire().procedures.conversation.newChat({ agent, title: newChatTitle(text), parent: where.kind === "default" ? null : where.node.id }))
        if (!alive) return
        if (result._tag === "Failure") { restore(); fail(result.failure.message); return }
        value = result.success
      }
      const { node, to, refusal } = value
      const later = draft()
      setDraft("")
      handed = true
      arrivals.set(node, { engine: agent, text, later, to, refusal, done: () => { if (alive) setPending(false) } })
      // A replaced navigation provider is not the one this gesture opened in.
      const route = nav.route()
      const atDestination = route.kind === "at" && route.address?.kind === "node" && route.address.id === node
      if (navigation() !== nav || departed && !atDestination) { reclaim(node, arrivals.get(node)!); return }
      fail(null)
      nav.go(atNode(node))
      publish()
      choose({ kind: "default" })
    } finally { watches.delete(stopWatch); stopWatch(); if (!handed) setPending(false) }
  }
  return { focusRequest, pending, failure, draft, setDraft, location, choose, here, chosen, chooseEngine, open, start,
    origin, take: (node: string) => { revision(); const value = arrivals.get(node); arrivals.delete(node); return value } }
}
