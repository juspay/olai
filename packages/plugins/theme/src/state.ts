/** Fresh preference signals and observers belong to each provider activation.
 * Stored choices outlive the provider; DOM writes and listeners do not. */
import { Effect } from "effect"
import { createSignal } from "solid-js"
import { DEFAULT_TYPEFACE, FONT_ATTRIBUTE, FONT_STORAGE_KEY, typefaceNamed } from "@olai/fonts"
import { readPreference, watchPreference, writePreference } from "@olai/web/client/preference.ts"
import { createChrome } from "./chrome.ts"
import { DEFAULT_PALETTE, THEME_ATTRIBUTE, THEME_STORAGE_KEY, paletteNamed } from "@olai/appearance/palettes.ts"
import { DEFAULT_TYPE_SIZE, SIZE_ATTRIBUTE, SIZE_STORAGE_KEY, sizeNamed } from "@olai/appearance/sizes.ts"
import type { Appearance, Choice } from "./index.ts"

const choice = <T extends { readonly name: string }>(config: {
  readonly attribute: string
  readonly key: string
  readonly fallback: T
  readonly named: (name: string) => T | undefined
  readonly shown?: (value: T) => void
}) => Effect.gen(function*() {
  const root = document.documentElement
  yield* Effect.acquireRelease(Effect.sync(() => root.getAttribute(config.attribute)), (previous) => Effect.sync(() => {
    if (previous === null) root.removeAttribute(config.attribute)
    else root.setAttribute(config.attribute, previous)
  }))
  const [current, setCurrent] = createSignal(config.fallback)
  const show = (selected: T | undefined) => {
    if (selected === undefined) root.removeAttribute(config.attribute)
    else root.setAttribute(config.attribute, selected.name)
    const value = selected ?? config.fallback
    setCurrent(() => value)
    config.shown?.(value)
  }
  const stored = readPreference(config.key)
  const selected = stored === null ? undefined : config.named(stored)
  if (stored !== null && selected === undefined) writePreference(config.key, null)
  show(selected)
  yield* Effect.acquireRelease(Effect.sync(() => watchPreference(config.key, (value) => {
    if (value === null) show(undefined)
    else {
      const next = config.named(value)
      if (next !== undefined) show(next)
    }
  })), (stop) => Effect.sync(stop))
  let active = true
  yield* Effect.addFinalizer(() => Effect.sync(() => { active = false }))
  return {
    current,
    pick: (value: T) => {
      if (!active) throw new Error("The appearance provider is no longer active")
      const selected = config.named(value.name)
      if (selected === undefined) throw new Error(`Unknown appearance choice: ${value.name}`)
      show(selected)
      writePreference(config.key, selected.name)
    },
  } satisfies Choice<T>
})

export const createAppearance = Effect.gen(function*() {
  const chrome = yield* Effect.acquireRelease(Effect.sync(createChrome), (owned) => Effect.sync(owned.close))
  const theme = yield* choice({ attribute: THEME_ATTRIBUTE, key: THEME_STORAGE_KEY, fallback: DEFAULT_PALETTE, named: paletteNamed, shown: chrome.paint })
  const font = yield* choice({ attribute: FONT_ATTRIBUTE, key: FONT_STORAGE_KEY, fallback: DEFAULT_TYPEFACE, named: typefaceNamed })
  const size = yield* choice({ attribute: SIZE_ATTRIBUTE, key: SIZE_STORAGE_KEY, fallback: DEFAULT_TYPE_SIZE, named: sizeNamed })
  return { theme, font, size, chrome } satisfies Appearance
})
