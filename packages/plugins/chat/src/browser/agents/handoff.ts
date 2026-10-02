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
import { createEffect, createSignal, onCleanup, untrack } from "solid-js"
import { isPutAway } from "@olai/format"
import type { Navigation } from "olai-plugin-navigation/contract"
import { atNode } from "olai-plugin-navigation/routes"
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

export const createHandoff = (input: {
  /** A claimed arrival's words, delivered to the conversation it named. */
  readonly keep: (to: Conversing, text: string) => void
}) => {
  const arrivals = new Map<string, Arrival>()
  const parked = new Map<string, Arrival>()
  const [revision, revise] = createSignal(0)
  /** Told to the page faces, so a `take` in their effect sees the new arrival. */
  const announce = () => revise(value => value + 1)
  const abandon = (node: string, arrival: Arrival) => {
    arrivals.delete(node)
    if (arrival.to === null) parked.set(node, { ...arrival, done: () => {} })
    else input.keep(arrival.to, arrival.text)
    arrival.done()
    announce()
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
    land: (node: string, arrival: Arrival, from: { readonly nav: Navigation; readonly signal: AbortSignal }) => {
      arrivals.set(node, arrival)
      if (from.signal.aborted || navigation() !== from.nav) { abandon(node, arrival); return }
      from.nav.go(atNode(node))
      announce()
    },
    take: (node: string) => {
      revision()
      const value = arrivals.get(node) ?? parked.get(node)
      arrivals.delete(node); parked.delete(node)
      return value
    },
  }
}
