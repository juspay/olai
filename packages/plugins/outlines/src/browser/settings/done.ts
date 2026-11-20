import { heldService } from "@olai/ui-primitives/held.ts"

import { type Accessor, createSignal } from "solid-js"

import type { Shown } from "@olai/format"

import { boolCodec, createPreference } from "@olai/web/client/preference.ts"

import { DONE_HIDDEN_KEY, DONE_OVERRIDES_KEY } from "../../contracts/preferences.ts"
export { DONE_HIDDEN_KEY, DONE_OVERRIDES_KEY } from "../../contracts/preferences.ts"

type DoneWord = "shown" | "hidden"

const makePref = () => createPreference(DONE_HIDDEN_KEY, boolCodec(true))
const [pref, setPref] = createSignal(makePref())

const makeOverrides = () => createPreference(DONE_OVERRIDES_KEY, {
  parse: (stored) => {
    if (stored === null) return new Map<string, DoneWord>()
    let parsed: unknown
    try {
      parsed = JSON.parse(stored)
    } catch {
      return new Map<string, DoneWord>()
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return new Map<string, DoneWord>()
    const out = new Map<string, DoneWord>()
    for (const [file, word] of Object.entries(parsed)) {
      if (word === "shown" || word === "hidden") out.set(file, word)
    }
    return out
  },
  print: (map) =>
    map.size === 0
      ? null
      : JSON.stringify(
          Object.fromEntries(
            [...map.entries()].sort(([a], [b]) => a.localeCompare(b)),
          ),
        ),
})
const [overrides, setOverrides] = createSignal(makeOverrides())

export const doneHidden: Accessor<boolean> = () => pref().value()

export const setDoneHidden = (value: boolean): void => pref().set(value)

export const doneOverride = (file: string): DoneWord | undefined =>
  overrides().value().get(file)

export const doneHiddenOn = (file: string): boolean =>
  (overrides().value().get(file) ?? (doneHidden() ? "hidden" : "shown")) ===
  "hidden"

export const setDoneFor = (file: string, word: DoneWord): void => {
  const combined = new Map([...overrides().value(), ...overrides().stored()])
  combined.set(file, word)
  overrides().set(combined)
}

export const letDoneFollow = (file: string): void => {
  const combined = new Map([...overrides().value(), ...overrides().stored()])
  combined.delete(file)
  overrides().set(combined)
}

type Reveals = ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>
export const createDoneReveals = () => {
  const [read, set] = createSignal<Reveals>(new Map())
  return { read, set }
}
const heldReveals = heldService<ReturnType<typeof createDoneReveals>>()
export const holdDoneReveals = heldReveals.hold
const emptyReveals: Reveals = new Map()
const revealed = (): Reveals => heldReveals.read()?.read() ?? emptyReveals
const setRevealed = (next: (before: Reveals) => Reveals) => heldReveals.read()?.set(next)


export const landingReveal = (
  file: string,
  pane: string,
): ReadonlySet<string> | undefined => revealed().get(pane)?.get(file)

export const revealDone = (
  file: string,
  pane: string,
  keys: ReadonlySet<string>,
): ReadonlySet<string> => {
  const standing = revealed().get(pane)?.get(file)
  if (
    standing !== undefined && standing.size === keys.size &&
    [...keys].every((key) => standing.has(key))
  ) {
    return standing
  }
  setRevealed((before) => {
    const next = new Map(before)
    const box = new Map(before.get(pane))
    box.set(file, keys)
    next.set(pane, box)
    return next
  })
  return keys
}

export const concealDone = (
  file: string,
  pane: string,
  keys: ReadonlySet<string>,
): void => {
  if (revealed().get(pane)?.get(file) !== keys) return
  setRevealed((before) => {
    const next = new Map(before)
    const box = new Map(before.get(pane))
    box.delete(file)
    if (box.size === 0) next.delete(pane)
    else next.set(pane, box)
    return next
  })
}

export const pageFileOf = (page: Shown | undefined): string | undefined => {
  if (page === undefined) return undefined
  if (page.kind === "outline") return page.file
  if (page.kind === "node" && page.zoomed.kind === "node") {
    return page.zoomed.shows.file
  }
  return undefined
}

export const followDonePrefs = (): (() => void) => {
  setPref(makePref())
  setOverrides(makeOverrides())
  const stopDefault = pref().follow()
  const stopOverrides = overrides().follow()
  return () => { stopDefault(); stopOverrides() }
}
