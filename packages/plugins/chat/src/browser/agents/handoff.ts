/**
 * WHERE A NEW CHAT'S FIRST MESSAGE GOES, and what brings the words back when
 * it cannot get there.
 *
 * A send mints a node and records an {@link Arrival} for it; the page that
 * opens that node CLAIMS the arrival (`take`) and delivers the words. Two
 * things take the hand-off back instead, and they are one decision — "the
 * person is not on that page" — read off two clocks, which is why they live
 * together here rather than spread through the sender:
 *
 *   - the STANDING watch: while an arrival is unclaimed, a route or a reading
 *     that stops naming its node returns the words;
 *   - disposal: the activation going away claims nothing, so every unclaimed
 *     arrival is returned.
 *
 * Landing is this module's too (`land`): an arrival whose asking level is
 * already gone, or whose navigation was replaced, is reclaimed at once and
 * nothing navigates; otherwise its node's page is opened. An arrival is
 * reclaimed exactly once, and a claimed one is never reclaimed.
 *
 * Returned words become the conversation's unsent draft. A node whose start
 * was refused has no conversation yet, so its words are PARKED for that node:
 * its page claims them like an arrival whenever it is next opened.
 */
import { batch, createEffect, createSignal, onCleanup, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { isPutAway } from "@olai/format"
import type { Navigation } from "olai-plugin-navigation/contract"
import { zoomNode } from "olai-plugin-navigation/routes"
import { servedDirectory } from "../vault.ts"
import { navigation } from "../navigation.ts"
import { pageReadings } from "../pages.ts"
import type { Conversing } from "../../sessions.ts"

/** The words one send handed to a conversation, and who owes them an answer.
 * `to === null` is the node that was minted but whose start was refused: its
 * own page takes the words, so one more Send retries on that node. `done`
 * releases what the sender held for it, once the words are placed. */
export interface Arrival {
  readonly engine: string
  readonly text: string
  readonly to: Conversing | null
  readonly refusal: string | null
  readonly done: () => void
}

/** What a node's page lends an arrival: its own surfaces, and nothing about
 *  what an arrival means. */
export interface Receiving {
  /** The engine the page's composer should offer first. */
  readonly prefer: (engine: string) => void
  /** What the start said, or `null`. */
  readonly refuse: (refusal: string | null) => void
  /** Put words in front of the page's plain draft. */
  readonly redraft: (words: string) => void
  /** Send the words to the conversation; settles once they are placed. */
  readonly deliver: (to: Conversing, text: string) => Promise<void>
}

/**
 * WHAT A CLAIMED ARRIVAL MEANS ON ITS PAGE — the policy, here beside the
 * hand-off that made it rather than in each page: the engine it was sent with
 * is preferred and the start's refusal is shown; words with a conversation
 * are delivered to it; words without one (a refused start) become the plain
 * draft, ready for one more Send. Either way the sender is released once the
 * words are placed.
 */
export const receive = (arrival: Arrival, page: Receiving): void => {
  page.prefer(arrival.engine)
  page.refuse(arrival.refusal)
  if (arrival.to === null) { page.redraft(arrival.text); arrival.done(); return }
  void page.deliver(arrival.to, arrival.text).finally(arrival.done)
}

export const createHandoff = (input: {
  /** A claimed arrival's words, delivered to the conversation it named. */
  readonly keep: (to: Conversing, text: string) => void
}) => {
  const arrivals = new Map<string, Arrival>()
  const parked = new Map<string, Arrival>()
  /** How many arrivals are unclaimed: the standing watch reads nothing else
   *  while there are none. */
  const [outstanding, count] = createSignal(0)
  /** One tick per node, so an arrival wakes only that node's page faces. */
  const [ticks, tick] = createStore<Record<string, number>>({})
  const announce = (node: string) => tick(node, value => (value ?? 0) + 1)
  const forget = (node: string) => { if (arrivals.delete(node)) count(arrivals.size) }
  const abandon = (node: string, arrival: Arrival) => batch(() => {
    forget(node)
    if (arrival.to === null) parked.set(node, { ...arrival, done: () => {} })
    else input.keep(arrival.to, arrival.text)
    arrival.done()
    announce(node)
  })
  createEffect(() => {
    if (outstanding() === 0) return
    const nav = navigation()
    const route = nav?.route()
    const pane = nav?.panes()[nav.focusIndex()]
    const shows = pane === undefined ? undefined : pageReadings()?.at(pane.id)?.shows
    const claims = servedDirectory()?.claims()
    const unavailable = shows?.kind === "node" && (shows.zoomed.kind !== "node" || claims !== undefined && isPutAway(claims, shows.zoomed.shows.file))
    untrack(() => {
      for (const [node, arrival] of arrivals) {
        if (route?.kind !== "at" || route.address?.kind !== "node" || route.address.id !== node || unavailable) abandon(node, arrival)
      }
    })
  })
  onCleanup(() => {
    for (const [node, arrival] of arrivals) abandon(node, arrival)
    parked.clear()
  })
  return {
    /** Hand the words to `node`'s page and open it — unless the level that
     *  asked is gone, or navigation was replaced since it asked, in which case
     *  the words are returned at once and nothing navigates. */
    land: (node: string, arrival: Arrival, from: { readonly nav: Navigation; readonly signal: AbortSignal }) => batch(() => {
      arrivals.set(node, arrival)
      count(arrivals.size)
      if (from.signal.aborted || navigation() !== from.nav) { abandon(node, arrival); return }
      // In one batch with the arrival: the standing watch first runs against
      // the route this lands on, never the one it leaves.
      from.nav.go(zoomNode(node))
      announce(node)
    }),
    /** Claim `node`'s arrival (or its parked words), once. Read in a page's
     *  effect, it subscribes to that node's tick alone. */
    take: (node: string) => {
      void ticks[node]
      const value = arrivals.get(node) ?? parked.get(node)
      forget(node); parked.delete(node)
      return value
    },
  }
}
