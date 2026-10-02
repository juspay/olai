/**
 * WHERE A SENT DRAFT GOES, and what brings the words back when it cannot.
 *
 * A send mints (or seats) a node and records an {@link Arrival} for it; the
 * face that opens that node's page CLAIMS the arrival (`take`) and delivers
 * the words. Three things can take the hand-off back instead, and they are one
 * decision — "the person is no longer where this was pressed" — read off three
 * clocks, which is why they live together here rather than spread through the
 * sender:
 *
 *   - the STANDING watch: while an arrival is unclaimed, a route or a reading
 *     that stops naming its node returns the words to the draft;
 *   - the GESTURE watch: the page a send was pressed from, compared against
 *     what is on screen when the server answers;
 *   - disposal: the activation going away claims nothing, so every unclaimed
 *     arrival is returned.
 *
 * They must agree, and one owner is how: an arrival is reclaimed exactly once,
 * and a claimed one is never reclaimed.
 */
import { createEffect, createRoot, createSignal, onCleanup, untrack } from "solid-js"
import { isPutAway } from "@olai/format"
import type { Navigation } from "olai-plugin-navigation/contract"
import { servedDirectory } from "../vault.ts"
import { navigation } from "../navigation.ts"
import { pageReadings } from "../pages.ts"
import type { Conversing } from "../../sessions.ts"

/** The words one send handed to a conversation, and who owes them an answer.
 * `to === null` is the node that was minted but whose start was refused: its
 * own page takes the words, so one more Send retries on that node. */
export interface Arrival {
  readonly engine: string
  readonly text: string
  readonly later: string
  readonly to: Conversing | null
  readonly refusal: string | null
  readonly done: () => void
}

/** The page a send was pressed from, watched until its call lands or the page
 *  is left. */
export interface Gesture {
  readonly departed: () => boolean
  readonly settle: () => void
}

export const createHandoff = (input: {
  /** A claimed arrival's words, delivered to the conversation it named. */
  readonly keep: (to: Conversing, text: string) => void
  /** An unclaimed arrival's words, put back in front of whatever is there. */
  readonly redraft: (words: string) => void
}) => {
  const arrivals = new Map<string, Arrival>()
  const watches = new Set<() => void>()
  const [revision, revise] = createSignal(0)
  /** Told to the page faces, so a `take` in their effect sees the new arrival. */
  const announce = () => revise(value => value + 1)
  const abandon = (node: string, arrival: Arrival) => {
    arrivals.delete(node)
    const words = arrival.later === "" ? arrival.text : `${arrival.text}\n${arrival.later}`
    if (arrival.to === null) input.redraft(words)
    else input.keep(arrival.to, words)
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
    for (const stop of watches) stop()
    watches.clear()
    for (const [node, arrival] of arrivals) abandon(node, arrival)
  })
  return {
    /** Begin watching the page a send was pressed from. */
    gesture: (nav: Navigation): Gesture => {
      const startedAt = nav.route()
      let departed = false
      const stop = createRoot(dispose => {
        createEffect(() => { if (!nav.routes.samePage(nav.route(), startedAt)) departed = true })
        return dispose
      })
      watches.add(stop)
      return { departed: () => departed, settle: () => { watches.delete(stop); stop() } }
    },
    /** Hand the words to the conversation that will answer them. Announcing is
     *  the sender's, after it has decided the hand-off stands. */
    record: (node: string, arrival: Arrival) => { arrivals.set(node, arrival) },
    reclaim: (node: string) => {
      const arrival = arrivals.get(node)
      if (arrival !== undefined) abandon(node, arrival)
    },
    announce,
    take: (node: string) => { revision(); const value = arrivals.get(node); arrivals.delete(node); return value },
  }
}
