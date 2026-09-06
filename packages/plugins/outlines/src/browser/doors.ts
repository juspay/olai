/**
 * WHAT THE PROPERTY VALUES THIS PAGE DRAWS NAME — the table, and the rule about
 * when it moves.
 *
 * `./names.ts` one question over, and deliberately its twin: the same shape,
 * the same memo, the same comparator argument. What differs is only what is
 * being looked up — an id's title there, a value's meaning here — and the
 * reason both are tables rather than questions the browser asks is one reason:
 * the tab holds a page, not a vault, so neither answer is derivable up here
 * (`@olai/format`'s `meaning.ts`).
 *
 * ## Keyed on the triple, because the pair would be wrong
 *
 * A value is looked up by the file it was WRITTEN in, its key and itself. The
 * file is not decoration: a `doc` key that resolves beside the writer answers
 * `briefs/tp.md` differently on a row of `roadmap/features.olai` and a row of
 * the root, so a table keyed by key-and-value would hand one of those rows the
 * other's answer. It is the same triple the projection dedupes on
 * (`@olai/format`'s `pageOf`), joined the same way, so the two cannot spell a
 * key differently.
 *
 * ## Why the memo has an `equals` on it
 *
 * `./names.ts`'s paragraph, word for word and for the same measured reason: a
 * NAVIGATION blanks the subscription, so the arriving page's first frame has
 * nothing to merge into and the store adopts it whole — every reader wakes,
 * whatever the value says. Two pages drawing the same lane board is the
 * ordinary case, and without the comparison every chip of the arriving page
 * would re-run for a table saying exactly what the last one said.
 *
 * THE COPY IS THE MECHANISM: a comparator needs two values, and the store's
 * array is identity-stable across frames, so a memo handing it straight back
 * would be comparing one value with itself and would report every frame
 * unchanged.
 */

import type { Door, Meaning, PageReading } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

/** What a property value on this page names — `undefined` for one that names
 *  nothing, which is nearly every value and is what makes a chip stay text. */
export type Doors = (from: string, key: string, value: string) => Meaning | undefined

/** THE TRIPLE, joined on a character no path, key or value can hold — a value
 *  is somebody's prose and may carry any separator a reader would think of,
 *  which is why this one is not a separator anybody would think of. */
const at = (from: string, key: string, value: string): string =>
  `${from}\u0000${key}\u0000${value}`

export const createDoors = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Doors> => {
  // Copying is what reads every field of every door, which is what subscribes
  // this to every frame; `equals` is what stops it there.
  const held = createMemo(
    (): ReadonlyArray<Door> =>
      (reading()?.doors ?? []).map((one) => ({
        from: one.from,
        prop: one.prop,
        value: one.value,
        opens: { ...one.opens },
      })),
    undefined,
    { equals: sameDoors },
  )
  return createMemo<Doors>(() => {
    const table = new Map<string, Meaning>()
    for (const one of held()) table.set(at(one.from, one.prop, one.value), one.opens)
    return (from, key, value) => table.get(at(from, key, value))
  })
}

/** The same doors in the same order — what "nothing this page draws changed
 *  what it names" means. The whole of a door is its triple and its answer, and
 *  an answer is a tagged struct of at most three fields, so this is a walk
 *  rather than anything cleverer. */
const sameDoors = (a: ReadonlyArray<Door>, b: ReadonlyArray<Door>): boolean =>
  a.length === b.length &&
  a.every((one, index) => {
    const other = b[index]
    return other !== undefined &&
      one.from === other.from && one.prop === other.prop && one.value === other.value &&
      sameMeaning(one.opens, other.opens)
  })

/** Whether two answers name the same thing. Written out rather than derived
 *  from the schema because this runs per door per frame and a structural
 *  equivalence would walk a decoder's worth of machinery to compare four
 *  fields — the same trade `./names.ts` makes one table over. */
const sameMeaning = (one: Meaning, other: Meaning): boolean => {
  switch (one.kind) {
    case "document":
      return other.kind === "document" && one.file === other.file
    case "node":
      return other.kind === "node" && one.id === other.id && one.titled === other.titled
    case "day":
      return other.kind === "day" && one.date === other.date
    case "away":
      return other.kind === "away" && one.href === other.href
  }
}
