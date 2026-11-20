import { createSignal } from "solid-js"

import type { Accessor } from "solid-js"

import type { HomesAnswer, HomesRequest } from "@olai/format"

import { createPreference, parsedJson } from "@olai/web/client/preference.ts"
import type { Fold } from "./rows.ts"

export const FOLDS_KEY = "olai.folds"

export type Folds = ReadonlyMap<string, ReadonlySet<string>>

export const parseFolds = (raw: string | null): Folds => {
  const decoded = parsedJson(raw)
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    return new Map()
  }
  const out = new Map<string, ReadonlySet<string>>()
  for (const [file, ids] of Object.entries(decoded)) {
    if (!Array.isArray(ids)) continue
    const kept = ids.filter((id): id is string => typeof id === "string")
    if (kept.length > 0) out.set(file, new Set(kept))
  }
  return out
}

export const printFolds = (folds: Folds): string | null => {
  if (folds.size === 0) return null
  const out: Record<string, ReadonlyArray<string>> = {}
  for (const file of [...folds.keys()].sort()) {
    out[file] = [...(folds.get(file) ?? [])].sort()
  }
  return JSON.stringify(out)
}

export const withFolds = (
  folds: Folds,
  given: ReadonlyArray<Fold>,
  collapsed: boolean,
): Folds => {
  const next = new Map<string, Set<string>>()
  for (const [file, ids] of folds) next.set(file, new Set(ids))
  for (const fold of given) {
    for (const [file, ids] of next) {
      if (file === fold.file) continue
      if (ids.delete(fold.id) && ids.size === 0) next.delete(file)
    }
    const ids = next.get(fold.file) ?? new Set<string>()
    if (collapsed) ids.add(fold.id)
    else ids.delete(fold.id)
    if (ids.size === 0) next.delete(fold.file)
    else next.set(fold.file, ids)
  }
  return next
}

export type Homes = ReadonlyMap<string, string | null>

export const askingOf = (memory: Memory): HomesRequest => ({
  ids: [...memory.ids],
  files: [...memory.byFile.keys()],
})

export const homesOf = (asked: Memory, answer: HomesAnswer): Homes => {
  const at = new Map(answer.homes.map((home) => [home.id, home.file]))
  const loaded = new Set(answer.loaded)
  const said = new Map<string, string | null>()
  for (const [file, ids] of asked.byFile) {
    for (const id of ids) {
      const home = at.get(id)
      if (home !== undefined) said.set(id, home)
      else if (loaded.has(file)) said.set(id, null)
    }
  }
  return said
}

export const pruned = (folds: Folds, homes: Homes): Folds => {
  const next = new Map<string, Set<string>>()
  for (const [file, ids] of folds) {
    for (const id of ids) {
      const home = homes.get(id)
      if (home === null) continue
      const into = home ?? file
      const own = next.get(into)
      if (own === undefined) next.set(into, new Set([id]))
      else own.add(id)
    }
  }
  return next
}

const merged = (folds: Folds): ReadonlySet<string> => {
  const out = new Set<string>()
  for (const ids of folds.values()) for (const id of ids) out.add(id)
  return out
}

/**
 * So a write reads the entry back, unions it with what this tab holds, and
 * applies its own change on top — which is why the change goes on LAST and why
 * this is a union rather than a merge with rules: an unfold is a removal, and a
 * removal that ran before the union would be undone by it.
 */
export const combined = (stored: Folds, held: Folds): Folds => {
  const out = new Map<string, Set<string>>()
  for (const source of [stored, held]) {
    for (const [file, ids] of source) {
      const into = out.get(file)
      if (into === undefined) out.set(file, new Set(ids))
      else for (const id of ids) into.add(id)
    }
  }
  return out
}

export interface Memory {
  readonly byFile: Folds
  readonly ids: ReadonlySet<string>
  readonly printed: string | null
}

export const memoryOf = (byFile: Folds): Memory => {
  let ids: ReadonlySet<string> | undefined
  let printed: string | null | undefined
  return {
    byFile,
    get ids() {
      return (ids ??= merged(byFile))
    },
    get printed() {
      if (printed === undefined) printed = printFolds(byFile)
      return printed
    },
  }
}

const makePref = () => createPreference(FOLDS_KEY, {
  parse: (raw) => memoryOf(parseFolds(raw)),
  print: (memory) => memory.printed,
})
const [pref, setPref] = createSignal(makePref())

export const collapsedNodes: Accessor<ReadonlySet<string>> = () => pref().value().ids

export const folded: Accessor<Memory> = () => pref().value()

const standing = (): Folds => combined(pref().stored().byFile, pref().value().byFile)

export const setFolded = (given: ReadonlyArray<Fold>, collapsed: boolean): void => {
  pref().set(memoryOf(withFolds(standing(), given, collapsed)))
}

export const refiled = (homes: Homes): void => {
  const now = standing()
  const next = memoryOf(pruned(now, homes))
  if (next.printed === printFolds(now)) return
  pref().set(next)
}

export const followFolds = (): (() => void) => {
  setPref(makePref())
  return pref().follow()
}
