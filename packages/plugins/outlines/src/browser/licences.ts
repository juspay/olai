import { createStore, reconcile } from "solid-js/store"

import type { Licence, PageReading } from "@olai/format"
import { type Accessor, createMemo, createRenderEffect } from "solid-js"

declare const declaredKind: unique symbol
export type Kind = string & { readonly [declaredKind]: true }

export type Licences = (from: string, key: string, value: string) => Kind | undefined

type Worded = Record<string, Record<string, Record<string, string>> | undefined>

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
  const [table, setTable] = createStore<Worded>({})
  createRenderEffect(() => {
    const next: Record<string, Record<string, Record<string, string>>> = {}
    for (const one of held()) ((next[one.from] ??= {})[one.prop] ??= {})[one.value] = one.word
    setTable(reconcile(next))
  })
  const lookup: Licences = (from, key, value) => table[from]?.[key]?.[value] as Kind | undefined
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
