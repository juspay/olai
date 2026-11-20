import { createStore, reconcile } from "solid-js/store"

import type { Door, Meaning, PageReading } from "@olai/format"
import { type Accessor, createMemo, createRenderEffect } from "solid-js"

export type Doors = (from: string, key: string, value: string) => Meaning | undefined

const at = (from: string, key: string, value: string): string =>
  `${from}\u0000${key}\u0000${value}`

export const createDoors = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Doors> => {
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

const sameDoors = (a: ReadonlyArray<Door>, b: ReadonlyArray<Door>): boolean =>
  a.length === b.length &&
  a.every((one, index) => {
    const other = b[index]
    return other !== undefined &&
      one.from === other.from && one.prop === other.prop && one.value === other.value &&
      sameMeaning(one.opens, other.opens)
  })

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
