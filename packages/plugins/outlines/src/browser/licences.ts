import { createStore, reconcile } from "solid-js/store"
/** The page's lookup is stable for its lifetime. Frames reconcile individual
 * keys, so readers track the name/door/licence they actually use. The copied
 * wire values also avoid invalidating unchanged keys after navigation. */

import type { Licence, PageReading } from "@olai/format"
import { type Accessor, createMemo, createRenderEffect } from "solid-js"

/** What word claims a property value on this page — `undefined` for one nothing
 *  claims, which is nearly every value and is what makes a property draw as the
 *  plain chip it always did. */
export type Licences = (from: string, key: string, value: string) => string | undefined

/** THE TRIPLE, joined on a character no path, key or value can hold — a value
 *  is somebody's prose and may carry any separator a reader would think of,
 *  which is why this one is not a separator anybody would think of. This
 *  table's own encoding; see the header for why it is not `./doors.ts`'s. */
const at = (from: string, key: string, value: string): string =>
  `${from}\u0000${key}\u0000${value}`

export const createLicences = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Licences> => {
  // Copying is what reads every field of every row, which is what subscribes
  // this to every frame; `equals` is what stops it there.
  const held = createMemo(
    (): ReadonlyArray<Licence> =>
      (reading()?.licences ?? []).map((one) => ({
        from: one.from,
        prop: one.prop,
        value: one.value,
        word: one.word,
      })),
    undefined,
    { equals: sameLicences },
  )
  const [table, setTable] = createStore<Record<string, string | undefined>>({})
  createRenderEffect(() => {
    const next = Object.fromEntries(held().map(one => [at(one.from, one.prop, one.value), one.word]))
    setTable(reconcile(next))
  })
  const lookup: Licences = (from, key, value) => table[at(from, key, value)]
  return () => lookup
}

/** The same licences in the same order — what "nothing this page draws changed
 *  what claims it" means. Four strings, so this is a walk rather than anything
 *  cleverer (`./doors.ts` makes the same trade about a tagged answer). */
const sameLicences = (a: ReadonlyArray<Licence>, b: ReadonlyArray<Licence>): boolean =>
  a.length === b.length &&
  a.every((one, index) => {
    const other = b[index]
    return other !== undefined &&
      one.from === other.from && one.prop === other.prop &&
      one.value === other.value && one.word === other.word
  })
