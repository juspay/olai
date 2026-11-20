import { type Accessor, createSignal } from "solid-js"

import { grumble } from "./grumble.ts"

export const readPreference = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const parseBool = (raw: string | null, fallback: boolean): boolean => {
  if (raw === null) return fallback
  return raw === "true"
}

export const parsedJson = (raw: string | null): unknown => {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export const writePreference = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch (cause) {
    grumble(
      key,
      `olai: this browser will not store "${key}", so the setting holds for this tab and is forgotten on reload`,
      cause,
    )
  }
}

export const preferenceChanged = (
  event: StorageEvent,
  key: string,
): string | null | undefined => {
  if (event.key === null) return null
  return event.key === key ? event.newValue : undefined
}

export const watchPreference = (
  key: string,
  apply: (value: string | null) => void,
): (() => void) => {
  const listener = (event: StorageEvent) => {
    const value = preferenceChanged(event, key)
    if (value !== undefined) apply(value)
  }
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}

export interface PreferenceCodec<T> {
  readonly parse: (raw: string | null) => T
  readonly print: (value: T) => string | null
}

export interface SetOptions {
  readonly persist?: boolean
}

export interface Preference<T> {
  readonly value: Accessor<T>
  readonly set: (next: T, opts?: SetOptions) => void
  readonly stored: () => T
  readonly follow: () => () => void
}

export const createPreference = <T>(
  key: string,
  codec: PreferenceCodec<T>,
): Preference<T> => {
  const [value, setValue] = createSignal(codec.parse(readPreference(key)))
  const hold = (next: T): void => void setValue(() => next)
  return {
    value,
    stored: () => codec.parse(readPreference(key)),
    set: (next, opts) => {
      hold(next)
      if (opts?.persist !== false) writePreference(key, codec.print(next))
    },
    follow: () => {
      hold(codec.parse(readPreference(key)))
      return watchPreference(key, (raw) => hold(codec.parse(raw)))
    },
  }
}

export const boolCodec = (fallback: boolean): PreferenceCodec<boolean> => ({
  parse: (raw) => parseBool(raw, fallback),
  print: String,
})
