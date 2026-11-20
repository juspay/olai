import { createStore, reconcile } from "solid-js/store"

import type { Named, PageReading } from "@olai/format"
import { type Accessor, createMemo, createRenderEffect } from "solid-js"

export type { Names } from "../contracts/names.ts"
import type { Names } from "../contracts/names.ts"

export const createNames = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Names> => {
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
