/**
 * WHAT THE ARMED NODES ARE CALLED — the composer's strip, asked of the server.
 *
 * A chip carries the ID (that is what was armed and what will be sent) and
 * draws the TITLE, because a handle in a strip of handles says nothing. The
 * title is a fact about the vault, and the browser used to look it up in its
 * own copy of every record (`nodeNamed`, over the tab's derivation). That copy
 * is gone (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`), and this is the same
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

import { type Accessor, createEffect, createMemo } from "solid-js"
import { createDeclared } from "olai-plugin-outlines/references"

/** Node titles follow the optional reference provider. Its absence leaves the
 * armed IDs intact, and reactivation creates fresh scoped metadata readers. */
export const createChipTitles = (
  ids: Accessor<ReadonlyArray<string>>,
): Accessor<ReadonlyMap<string, string>> => {
  const references = createDeclared()
  createEffect(() => references.want(ids()))
  return createMemo(() => new Map(ids().flatMap(id => {
    const title = references.named(id)
    return title === null ? [] : [[id, title] as const]
  })))
}
