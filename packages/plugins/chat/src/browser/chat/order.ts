import type { ChatEntry } from "olai-plugin-chat/wire"
import type { CollectionFold, CollectionFoldOptions } from "@kolu/surface/solid"
import { type Accessor, createMemo } from "solid-js"

import { asksInAForm, filedUnder } from "./lanes.ts"

export interface Ordered {
  readonly keys: ReadonlyArray<string>
  readonly lanes: ReadonlyMap<string, ReadonlyArray<string>>
  readonly seq: Map<string, number>
  readonly under: Map<string, string>
}

const ordered = (seq: Map<string, number>): ReadonlyArray<string> =>
  [...seq].sort(([, one], [, other]) => one - other).map(([key]) => key)

const NO_LANES: ReadonlyMap<string, ReadonlyArray<string>> = new Map()

const cut = (
  seq: Map<string, number>,
  under: Map<string, string>,
): { keys: ReadonlyArray<string>; lanes: ReadonlyMap<string, ReadonlyArray<string>> } => {
  const all = ordered(seq)
  if (under.size === 0) return { keys: all, lanes: NO_LANES }
  const keys: Array<string> = []
  const lanes = new Map<string, Array<string>>()
  for (const key of all) {
    const parent = under.get(key)
    if (parent === undefined || !seq.has(parent)) {
      keys.push(key)
      continue
    }
    const lane = lanes.get(parent)
    if (lane === undefined) lanes.set(parent, [key])
    else lane.push(key)
  }
  return { keys, lanes }
}

const intake = (entries: Iterable<ChatEntry>): { seq: Map<string, number>; under: Map<string, string> } => {
  const seq = new Map<string, number>()
  const under = new Map<string, string>()
  for (const entry of entries) {
    if (asksInAForm(entry)) continue
    seq.set(entry.id, entry.seq)
    const parent = filedUnder(entry)
    if (parent !== null) under.set(entry.id, parent)
  }
  return { seq, under }
}

const forget = (held: Ordered, key: string): boolean => {
  const wasOrdered = held.seq.delete(key)
  const wasFiled = held.under.delete(key)
  return wasOrdered || wasFiled
}

/**
 * The server's tick coalescer resolves an upsert-then-remove inside one producer
 * tick to a bare remove, so a row born and dead within one tick arrives as a
 * remove that was never preceded by an upsert.
 */
export const TRANSCRIPT_ORDER: CollectionFoldOptions<string, ChatEntry, Ordered> = {
  init: (entries) => {
    const { seq, under } = intake(entries.map(([, entry]) => entry))
    return { ...cut(seq, under), seq, under }
  },
  step: (held, { upserts, removes }) => {
    let moved = false
    let appendable = removes.length === 0 && held.under.size === 0
    let maximum = held.keys.length === 0 ? -Infinity : held.seq.get(held.keys.at(-1)!)!
    const appended: string[] = []
    for (const key of removes) if (forget(held, key)) moved = true
    for (const [key, entry] of upserts) {
      if (asksInAForm(entry)) {
        if (forget(held, key)) moved = true
        appendable = false
        continue
      }
      if (held.seq.get(key) !== entry.seq) {
        if (!held.seq.has(key) && entry.seq >= maximum) {
          appended.push(key)
          maximum = entry.seq
        } else appendable = false
        held.seq.set(key, entry.seq)
        moved = true
      }
      const parent = filedUnder(entry)
      if (parent !== null && held.under.get(key) !== parent) {
        appendable = false
        held.under.set(key, parent)
        moved = true
      }
    }
    if (moved && appendable) return { ...held, keys: [...held.keys, ...appended] }
    return moved ? { ...cut(held.seq, held.under), seq: held.seq, under: held.under } : held
  },
}

const NO_ROWS: ReadonlyArray<string> = []

export const orderOf = (
  entries: ReadonlyArray<ChatEntry>,
): { readonly keys: ReadonlyArray<string>; readonly lanes: ReadonlyMap<string, ReadonlyArray<string>> } => {
  const { seq, under } = intake(entries)
  return cut(seq, under)
}

/**
 * MUST be called under a reactive owner, which is the fold's own requirement:
 * the registration is dropped by that owner's `onCleanup`.
 */
export interface Rows {
  readonly keys: Accessor<ReadonlyArray<string>>
  readonly lanes: Accessor<ReadonlyMap<string, ReadonlyArray<string>>>
}

export const createRows = (fold: CollectionFold<string, ChatEntry>): Rows => {
  const order = fold(TRANSCRIPT_ORDER)
  return {
    keys: createMemo(() => order()?.keys ?? NO_ROWS),
    lanes: createMemo(() => order()?.lanes ?? NO_LANES),
  }
}
