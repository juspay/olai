import { createStore, reconcile } from "solid-js/store"
/** The page's lookup is stable for its lifetime. Frames reconcile individual
 * keys, so readers track the name/door/licence they actually use. The copied
 * wire values also avoid invalidating unchanged keys after navigation. */

import type { Named, PageReading } from "@olai/format"
import { type Accessor, createMemo, createRenderEffect } from "solid-js"

/** What the ids this page points at are called. */
export type { Names } from "../contracts/names.ts"
import type { Names } from "../contracts/names.ts"

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
  const [table, setTable] = createStore<Record<string, Named | undefined>>({})
  createRenderEffect(() => {
    const next = Object.fromEntries(held().map(one => [one.id, one]))
    setTable(reconcile(next))
  })
  const lookup: Names = (id) => table[id]
  return () => lookup
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
