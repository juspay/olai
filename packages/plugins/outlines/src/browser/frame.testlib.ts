import { writeWrappedValue } from "@kolu/surface/solid"
import { createStore } from "solid-js/store"

import type { Door, Licence, Named, PageReading, Row } from "@olai/format"

const FILE = "house.olai"

export const row = (
  key: string,
  id: string,
  title: string,
  children: ReadonlyArray<Row> = [],
): Row => ({
  kind: "node",
  key,
  at: { file: FILE, line: 1, node: { id, ord: "a0", title } },
  shows: { file: FILE, line: 1, node: { id, ord: "a0", title } },
  blocked: [],
  under: children.length,
  children,
})

export const named = (id: string, title: string): Named => ({ id, title, file: FILE })

export const page = (
  rows: ReadonlyArray<Row>,
  names: ReadonlyArray<Named> = [],
  doors: ReadonlyArray<Door> = [],
  licences: ReadonlyArray<Licence> = [],
): PageReading => ({
  shows: { kind: "outline", file: FILE, rows },
  names,
  doors,
  licences,
})

export const wired = (arrayKey?: string): {
  readonly reading: () => PageReading | undefined
  readonly write: (next: PageReading) => void
  readonly blank: () => void
} => {
  const [store, setStore] = createStore<{ v: PageReading | undefined }>({ v: undefined })
  return {
    reading: () => store.v,
    write: (next) => writeWrappedValue(setStore, next, arrayKey),
    blank: () => setStore("v", undefined),
  }
}
