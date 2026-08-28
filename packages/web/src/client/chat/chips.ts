/**
 * WHAT THE ARMED NODES ARE CALLED — the composer's strip, asked of the server.
 *
 * A chip carries the ID (that is what was armed and what will be sent) and
 * draws the TITLE, because a handle in a strip of handles says nothing. The
 * title is a fact about the vault, and the browser used to look it up in its
 * own copy of every record (`nodeNamed`, over the tab's derivation). That copy
 * is gone (`https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/vault-in-browser.md`), and this is the same
 * lookup one door along: `nodes.named`, the identical `nodeNamed` run where the
 * set is.
 *
 * ## Asked when the ARMING moves, and not when the vault does
 *
 * The composer is not a page, so there is no page reading for these ids to ride
 * on — the ids come from the `•••` menu of whatever was on screen and from the
 * `@` words in the draft, which is a set that changes when a person does
 * something rather than when a file does. So this asks on the set of ids and on
 * nothing else, and a retitle elsewhere reaches a chip on the next thing that
 * changes the arming.
 *
 * That is a real narrowing of what the local lookup gave — it tracked the live
 * set — and it is the same bound `./declared.ts` already argues one door over
 * for the transcript's marks: what is drawn is what was true when the question
 * was asked, and the question is asked again whenever the thing it is about
 * moves. What it buys is that a composer with three chips in it costs three
 * strings once, rather than a subscription to the vault.
 *
 * ## Nothing is asked into a dead wire
 *
 * A refused call leaves the titles as they were and the chips fall back to the
 * ids they carry, which is exactly what they draw before any answer and what a
 * dangling `see` draws for its reason: the strip says what is armed rather than
 * going blank about it. The app is frozen under an overlay while the wire is
 * down in any case (`../connection/Offline.tsx`), so there is no gesture that
 * could arm a node nobody can name.
 */

import { Result } from "effect"
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"

export const createChipTitles = (
  ids: Accessor<ReadonlyArray<string>>,
): Accessor<ReadonlyMap<string, string>> => {
  const [titles, setTitles] = createSignal<ReadonlyMap<string, string>>(new Map())
  createEffect(() => {
    const wanted = ids()
    if (wanted.length === 0) {
      setTitles(new Map())
      return
    }
    // The GUARD is the cleanup's, not a comparison of what came back against
    // what is armed now: two asks in flight settle in whatever order the wire
    // gives them, and the older one must not overwrite the newer. Solid disposes
    // the previous run of this effect before the next, so `live` is exactly
    // "this is still the question somebody is waiting on".
    let live = true
    onCleanup(() => {
      live = false
    })
    void runAsync(olai.procedures.nodes.named({ ids: wanted })).then((outcome) => {
      if (!live || Result.isFailure(outcome)) return
      setTitles(new Map(outcome.success.named.map((one) => [one.asked, one.title])))
    })
  })
  return titles
}
