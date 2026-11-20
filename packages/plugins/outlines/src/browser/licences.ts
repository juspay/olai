import { createStore, reconcile } from "solid-js/store"

import type { Licence, PageReading } from "@olai/format"
import { type Accessor, createMemo, createRenderEffect } from "solid-js"

export type Licences = (from: string, key: string, value: string) => string | undefined

const at = (from: string, key: string, value: string): string =>
  `${from}\u0000${key}\u0000${value}`

export const createLicences = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Licences> => {
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

const sameLicences = (a: ReadonlyArray<Licence>, b: ReadonlyArray<Licence>): boolean =>
  a.length === b.length &&
  a.every((one, index) => {
    const other = b[index]
    return other !== undefined &&
      one.from === other.from && one.prop === other.prop &&
      one.value === other.value && one.word === other.word
  })
