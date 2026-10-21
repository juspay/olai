/** Fresh preference signals and observers belong to each provider activation.
 * Stored choices outlive the provider; DOM writes and listeners do not. */
import { Effect } from "effect"
import { createSignal } from "solid-js"
import { DEFAULT_TYPEFACE, FONT_ATTRIBUTE, FONT_STORAGE_KEY, typefaceNamed } from "@olai/fonts"
import { readPreference, watchPreference, writePreference } from "@olai/web/client/preference.ts"
import { createChrome } from "./chrome.ts"
import { defaultPaletteFor, THEME_ATTRIBUTE, THEME_STORAGE_KEY, paletteNamed } from "@olai/appearance/palettes.ts"
import { DEFAULT_TYPE_SIZE, SIZE_ATTRIBUTE, SIZE_STORAGE_KEY, sizeNamed } from "@olai/appearance/sizes.ts"
import type { Appearance, Choice, ThemeChoice } from "./index.ts"

/** The media query this provider asks the OS's polarity of. */
const DARK_SCHEME = "(prefers-color-scheme: dark)"

const choice = <T extends { readonly name: string }>(config: {
  readonly attribute: string
  readonly key: string
  /** What the page is in when nothing is picked — an accessor, because for
   *  the theme that answer is the OS's and moves. */
  readonly fallback: () => T
  readonly named: (name: string) => T | undefined
  readonly shown?: (value: T) => void
}) => Effect.gen(function*() {
  const root = document.documentElement
  yield* Effect.acquireRelease(Effect.sync(() => root.getAttribute(config.attribute)), (previous) => Effect.sync(() => {
    if (previous === null) root.removeAttribute(config.attribute)
    else root.setAttribute(config.attribute, previous)
  }))
  const [current, setCurrent] = createSignal(config.fallback())
  const [picked, setPicked] = createSignal<T | undefined>(undefined)
  const show = (selected: T | undefined) => {
    if (selected === undefined) root.removeAttribute(config.attribute)
    else root.setAttribute(config.attribute, selected.name)
    const value = selected ?? config.fallback()
    setPicked(() => selected)
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
  const check = () => {
    if (!active) throw new Error("The appearance provider is no longer active")
  }
  return {
    current,
    picked,
    pick: (value: T) => {
      check()
      const selected = config.named(value.name)
      if (selected === undefined) throw new Error(`Unknown appearance choice: ${value.name}`)
      show(selected)
      writePreference(config.key, selected.name)
    },
    /** Forget the pick: the attribute comes off and the fallback answers. */
    clear: () => {
      check()
      show(undefined)
      writePreference(config.key, null)
    },
    /** Re-answer from the same pick — for when the FALLBACK moved under an
     *  unpicked page (the OS flipped its scheme). */
    refresh: () => {
      if (picked() === undefined) show(undefined)
    },
  }
})

/** The OS's polarity, as a signal this activation owns. A runtime with no
 *  `matchMedia` (a unit test's doubles) is read as light and never moves. */
const osScheme = Effect.acquireRelease(Effect.sync(() => {
  const query = typeof matchMedia === "function" ? matchMedia(DARK_SCHEME) : undefined
  const [dark, setDark] = createSignal(query?.matches ?? false)
  const listeners = new Set<() => void>()
  const onChange = (event: MediaQueryListEvent) => {
    setDark(event.matches)
    for (const listener of listeners) listener()
  }
  query?.addEventListener("change", onChange)
  return {
    dark,
    onChange: (listener: () => void) => { listeners.add(listener) },
    stop: () => { query?.removeEventListener("change", onChange); listeners.clear() },
  }
}), (owned) => Effect.sync(owned.stop))

export const createAppearance = Effect.gen(function*() {
  const chrome = yield* Effect.acquireRelease(Effect.sync(createChrome), (owned) => Effect.sync(owned.close))
  const os = yield* osScheme
  const themeChoice = yield* choice({
    attribute: THEME_ATTRIBUTE,
    key: THEME_STORAGE_KEY,
    fallback: () => defaultPaletteFor(os.dark() ? "dark" : "light"),
    named: paletteNamed,
    shown: chrome.paint,
  })
  // The OS flipping is a change to the FALLBACK, which only an unpicked page
  // reads: re-answer so the chrome (the status bar, the tab's mark) follows.
  os.onChange(themeChoice.refresh)
  const theme: ThemeChoice = {
    current: themeChoice.current,
    pick: themeChoice.pick,
    following: () => themeChoice.picked() === undefined,
    follow: themeChoice.clear,
  }
  const fontChoice = yield* choice({ attribute: FONT_ATTRIBUTE, key: FONT_STORAGE_KEY, fallback: () => DEFAULT_TYPEFACE, named: typefaceNamed })
  const sizeChoice = yield* choice({ attribute: SIZE_ATTRIBUTE, key: SIZE_STORAGE_KEY, fallback: () => DEFAULT_TYPE_SIZE, named: sizeNamed })
  const font: Choice<typeof DEFAULT_TYPEFACE> = { current: fontChoice.current, pick: fontChoice.pick }
  const size: Choice<typeof DEFAULT_TYPE_SIZE> = { current: sizeChoice.current, pick: sizeChoice.pick }
  return { theme, font, size, chrome } satisfies Appearance
})
