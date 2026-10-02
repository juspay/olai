import { createStore, reconcile } from "solid-js/store"
/** The page's lookup is stable for its lifetime. Frames reconcile individual
 * keys, so readers track the name/door/licence they actually use. The copied
 * wire values also avoid invalidating unchanged keys after navigation. */

import type { Door, Meaning, PageReading } from "@olai/format"
import { type Accessor, createMemo, createRenderEffect } from "solid-js"

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
  const [table, setTable] = createStore<Record<string, Meaning | undefined>>({})
  createRenderEffect(() => {
    const next = Object.fromEntries(held().map(one => [at(one.from, one.prop, one.value), one.opens]))
    setTable(reconcile(next))
  })
  const lookup: Doors = (from, key, value) => table[at(from, key, value)]
  return () => lookup
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
