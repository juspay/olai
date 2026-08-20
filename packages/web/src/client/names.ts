/**
 * WHAT THE IDS A PAGE POINTS AT ARE CALLED — the table, and the rule about
 * when it moves.
 *
 * A MAP built per answer rather than a scan of the array per link: a page of a
 * thousand rows each drawing two `see`s asks this two thousand times per draw,
 * and the table it is asked of is the ids that page mentions
 * (`@olai/format`'s `page.ts`, and the reading that carries it,
 * `./reading.tsx`).
 *
 * An id the table does not hold answers `undefined`, which every reader already
 * means something honest by: a `see` onto a node the set does not declare draws
 * its own id (the dangling link, as it always did), and a title that addresses
 * one is drawn by its own address (docs/format.md's Pins).
 *
 * ## Why this is a primitive and not a `createMemo` at each reader
 *
 * ONE SPELLING, because there are two readers at two depths: everything inside
 * a pane, which takes the table off the context (`./reading.tsx`'s
 * `NamesProvider`), and the chrome OUTSIDE the panes, which reads the focused
 * pane's reading out of the register and needs the same lookup over it
 * (`./App.tsx`, for the palette's pin row).
 *
 * And because the memo has a RULE in it that both of them need. Every frame the
 * server publishes replaces every element of `names` with a fresh object — the
 * store writes frames with `reconcile(next, { key: null })` and no `merge`
 * (docs/brainstorming/reactivity-after-the-flip.md §2) — so a memo that merely
 * built the table notified on EVERY frame, whatever the frame said. Its readers
 * are the leaves: every `NodeTitle`'s face memo, every `EdgeRefs` row, every
 * `NodeRefs` key. A page of a thousand rows re-ran all of them for a keystroke
 * in one title that named nothing (the audit's finding 2.10).
 *
 * So the table is rebuilt only when the names changed BY VALUE, and the held
 * copy is what makes that askable at all: `names` is identity-stable across
 * frames, so a previous value read back out of the store would be the same
 * array compared with itself and every frame would look unchanged. What is held
 * is a plain copy — the three fields a `Named` has — and a reader handed one is
 * handed something that stops moving when the answer does.
 *
 * ITS OWN MODULE, and not a corner of `./reading.tsx`, because the rule above
 * is a fact about VALUES rather than about who hands what to whom — and a rule
 * about values is checkable without a browser (`./names.browsertest.ts`).
 *
 * THE SHAPE HAS A NAME AND ONE OCCUPANT: hold the last value while a by-value
 * comparison says nothing changed, over a source whose own identity is stable.
 * The ordinary spelling for "did this change" is `equals` on a memo, and it
 * does not reach here — the array off the store is the SAME array frame after
 * frame, so an `equals` would be handed one value to compare with itself and
 * every frame would look unchanged. That is what makes the held plain copy the
 * mechanism rather than a nicety. One occupant is not a receptacle; a second
 * reader of the same shape is when it graduates.
 */

import type { Named, PageReading } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

/** What the ids this page points at are called. */
export type Names = (id: string) => Named | undefined

export const createNames = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Names> => {
  const held = createMemo<ReadonlyArray<Named>>((last) => {
    const names = reading()?.names ?? []
    // Reading every field is what subscribes this to every frame — and
    // returning `last` unchanged is what stops it there: Solid compares a
    // memo's value by identity, so an equal answer notifies nobody.
    return last !== undefined && sameNames(last, names)
      ? last
      : names.map((one) => ({ id: one.id, title: one.title, file: one.file }))
  })
  return createMemo<Names>(() => {
    const table = new Map(held().map((one) => [one.id, one]))
    return (id) => table.get(id)
  })
}

/** The same names, by value — the whole of a `Named` is its three fields. */
const sameNames = (
  held: ReadonlyArray<Named>,
  names: ReadonlyArray<Named>,
): boolean =>
  held.length === names.length &&
  held.every((one, at) => {
    const now = names[at]
    return now !== undefined &&
      one.id === now.id && one.title === now.title && one.file === now.file
  })
