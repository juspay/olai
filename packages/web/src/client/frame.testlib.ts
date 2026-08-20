/**
 * A PAGE FRAME, and the store one lands in — for the suites that ask what the
 * merge does rather than what a component draws.
 *
 * Two of them now (`./Tree.browsertest.ts` and `./names.browsertest.ts`, both
 * about `@olai/surface`'s declared `arrayKey`), and the deleted `frames.ts`'s
 * was a third, so this is `./filter/answered.testlib.ts`'s carve-out made for
 * the same reason word for word: it is the same dozen lines in both suites, and
 * one of them had already started drifting — its fixture was cast through
 * `unknown`, where the other's was typed, so a field added to `Row` would have
 * broken one and left the other compiling over a value the merge treats
 * differently from a real frame. Which is the one thing those suites measure.
 *
 * TYPED LITERALS rather than a walk over a fixture directory: what is being
 * measured is what the MERGE does to a frame, and a frame is a plain value
 * however it was computed. The types are `@olai/format`'s, so the value a test
 * writes is a value the wire could carry.
 */

import { writeWrappedValue } from "@kolu/surface/solid"
import { createStore } from "solid-js/store"

import type { Named, PageReading, Row } from "@olai/format"

/** Where every fixture here lives — one file, because none of these suites is
 *  about which file a row came out of. */
const FILE = "house.olai"

/** One row of an outline, at the PLACE `key` names.
 *
 *  `at` and `shows` are two distinct objects holding the same fields, which is
 *  what a walk produces for a plain node — and deliberately not one object at
 *  two paths, because a store target aliased that way is a different value than
 *  the wire sends. */
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

/** ...and one id the page points at, as the names table carries it. */
export const named = (id: string, title: string): Named => ({ id, title, file: FILE })

/** A page of one outline, as the wire speaks it. The names table is EXPLICIT
 *  and empty by default: a page that points at nothing is an ordinary page, and
 *  a table derived from the rows would be a second, wrong answer to what a row
 *  is called (a name is keyed by NODE id; a row by its place). */
export const page = (
  rows: ReadonlyArray<Row>,
  names: ReadonlyArray<Named> = [],
): PageReading => ({
  shows: { kind: "outline", file: FILE, rows },
  names,
})

/**
 * The store one pane holds, written the way the wire writes one.
 *
 * `writeWrappedValue` IS the one merge `@kolu/surface` performs, imported
 * rather than imitated — a hand-rolled `setStore(reconcile(…))` here would be
 * these suites agreeing with themselves about the very law they exist to pin.
 * `arrayKey` is passed through so a caller can drive BOTH arms: the key its
 * member declares, and none, which is master's behaviour exactly.
 *
 * `blank` is what the framework does to a subscription the moment its input
 * moves — `setStore("v", undefined)`, before the new question's first frame.
 *
 * NO `createRoot` here: what each suite hangs off the store is its own subject
 * (a keyed map's per-row bindings; a names table's copy), so the root belongs
 * to the caller, along with disposing it.
 */
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
