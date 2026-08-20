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
 * server published used to replace every element of `names` with a fresh object
 * — the store wrote frames with `reconcile(next, { key: null })` and no `merge`
 * (docs/brainstorming/reactivity-after-the-flip.md §2) — so a memo that merely
 * built the table notified on EVERY frame, whatever the frame said. Its readers
 * are the leaves: every `NodeTitle`'s face memo, every `EdgeRefs` row, every
 * `NodeRefs` key. A page of a thousand rows re-ran all of them for a keystroke
 * in one title that named nothing (the audit's finding 2.10).
 *
 * So the table is rebuilt only when the names changed BY VALUE — which is
 * `./served.tsx`'s arrangement over the served paths, word for word: a memo
 * whose `equals` compares the MEMBERSHIP, so the value's identity means "the
 * answer changed" rather than "a frame arrived", and Solid keeps the previous
 * value when the comparator says they are equal.
 *
 * ## Why the `equals` stayed when the merge learned about keys
 *
 * `@olai/surface`'s `page` stream declares `arrayKey: "key"` now
 * (juspay/kolu#2190), which took two thirds of the paragraph above away: `names`
 * carries no `key`, so it merges BY POSITION, and neither a repeated frame nor a
 * frame in which only a ROW moved writes anything into it. Those used to wake
 * the copy and be stopped here; they do not wake it at all, and the audit's 2.10
 * as originally written is upstream's now.
 *
 * It is kept for the case a key cannot reach: a NAVIGATION. A new question
 * blanks the subscription, so its first frame has nothing to merge into and the
 * store adopts it whole — every reader wakes, whatever the value says. Two
 * pages naming the same ids is the ordinary case (a zoom in, a zoom out, the
 * same outline reached twice), and without the comparison every leaf of the
 * arriving page would re-run for a table saying what the last one said. That is
 * measured rather than argued: `./names.browsertest.ts`'s second half counts the
 * copy's own runs on both sides of the declaration.
 *
 * THE COPY IS THE MECHANISM, not a nicety, and it is the one thing that
 * arrangement needs here and does not need there. A comparator needs two
 * values, and `reading.names` is identity-stable across frames — the same array
 * with different objects in it — so a memo handing back the store's array would
 * be handing the comparator one value to compare with itself, and every frame
 * would look unchanged. A plain copy of the three fields a `Named` has is what
 * makes the question askable, and a reader handed one is handed something that
 * stops moving when the answer does.
 *
 * ITS OWN MODULE, and not a corner of `./reading.tsx`, because the rule above
 * is a fact about VALUES rather than about who hands what to whom — and a rule
 * about values is checkable without a browser (`./names.browsertest.ts`).
 */

import type { Named, PageReading } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

/** What the ids this page points at are called. */
export type Names = (id: string) => Named | undefined

export const createNames = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Names> => {
  // Copying is what reads every field of every name, which is what subscribes
  // this to every frame; `equals` is what stops it there.
  const held = createMemo(
    (): ReadonlyArray<Named> =>
      (reading()?.names ?? []).map((one) => ({
        id: one.id,
        title: one.title,
        file: one.file,
      })),
    undefined,
    { equals: sameNames },
  )
  return createMemo<Names>(() => {
    const table = new Map<string, Named>()
    for (const one of held()) table.set(one.id, one)
    return (id) => table.get(id)
  })
}

/** The same names in the same order — what "nothing this page points at was
 *  renamed, or moved, or went away" means. The whole of a `Named` is its three
 *  fields, so this is a walk rather than anything cleverer. */
const sameNames = (
  a: ReadonlyArray<Named>,
  b: ReadonlyArray<Named>,
): boolean =>
  a.length === b.length &&
  a.every((one, at) => {
    const other = b[at]
    return other !== undefined &&
      one.id === other.id && one.title === other.title && one.file === other.file
  })
