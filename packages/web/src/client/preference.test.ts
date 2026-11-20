import { expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  createPreference,
  preferenceChanged,
  type PreferenceCodec,
} from "./preference.ts"

const KEY = "olai.theme"

const said = (key: string | null, newValue: string | null): StorageEvent =>
  ({ key, newValue }) as StorageEvent

test("another tab's pick under this key is the new value", () => {
  expect(preferenceChanged(said(KEY, "pitch"), KEY)).toBe("pitch")
})

test("another tab forgetting it is null, which is a value and not a silence", () => {
  expect(preferenceChanged(said(KEY, null), KEY)).toBeNull()
})

test("a cleared storage names no key, and clears this one too", () => {
  expect(preferenceChanged(said(null, null), KEY)).toBeNull()
})

test("somebody else's key is not this preference", () => {
  expect(preferenceChanged(said("olai.chat.open", "true"), KEY)).toBeUndefined()
  expect(preferenceChanged(said("theme", "pitch"), KEY)).toBeUndefined()
})

const wired = (
  entries: Record<string, string>,
  run: (
    fire: (key: string | null, newValue: string | null) => void,
    store: Map<string, string>,
  ) => void,
): void => {
  const store = new Map(Object.entries(entries))
  const listeners: Array<(event: StorageEvent) => void> = []
  const g = globalThis as Record<string, unknown>
  g.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  g.window = {
    addEventListener: (
      _type: string,
      listener: (event: StorageEvent) => void,
    ) => void listeners.push(listener),
  }
  try {
    run((key, newValue) => {
      for (const listener of listeners) listener(said(key, newValue))
    }, store)
  } finally {
    delete g.localStorage
    delete g.window
  }
}

const word: PreferenceCodec<string> = {
  parse: (raw) => raw ?? "plain",
  print: (value) => (value === "plain" ? null : value),
}

test("the first read goes through the codec, and no entry is the default", () => {
  wired({ "olai.word": "fancy" }, () => {
    expect(createPreference("olai.word", word).value()).toBe("fancy")
    expect(createPreference("olai.other", word).value()).toBe("plain")
  })
})

test("a set is applied to this tab and remembered through the print", () => {
  wired({}, (_fire, store) => {
    const pref = createPreference("olai.word", word)
    pref.set("fancy")
    expect(pref.value()).toBe("fancy")
    expect(store.get("olai.word")).toBe("fancy")
  })
})

test("a print of null is the key removed, not an empty husk left behind", () => {
  wired({ "olai.word": "fancy" }, (_fire, store) => {
    const pref = createPreference("olai.word", word)
    pref.set("plain")
    expect(pref.value()).toBe("plain")
    expect(store.has("olai.word")).toBe(false)
  })
})

test("persist: false is this tab persuaded and storage untouched", () => {
  wired({ "olai.word": "fancy" }, (_fire, store) => {
    const pref = createPreference("olai.word", word)
    pref.set("passing", { persist: false })
    expect(pref.value()).toBe("passing")
    expect(store.get("olai.word")).toBe("fancy")
  })
})

test("stored() is the entry as it is NOW, not as this tab last saw it", () => {
  wired({}, (_fire, store) => {
    const pref = createPreference("olai.word", word)
    store.set("olai.word", "sibling")
    expect(pref.stored()).toBe("sibling")
    expect(pref.value()).toBe("plain")
  })
})

test("following applies another tab's write through the same parse", () => {
  wired({}, (fire) => {
    const pref = createPreference("olai.word", word)
    pref.follow()
    fire("olai.word", "fancy")
    expect(pref.value()).toBe("fancy")
    fire(null, null)
    expect(pref.value()).toBe("plain")
    fire("olai.other", "loud")
    expect(pref.value()).toBe("plain")
  })
})

test("no client file outside this module spells the circuit's read or watch", () => {
  const allowed = new Set([
    "preference.ts",
    "preference.test.ts",
  ])
  const client = import.meta.dir
  const offenders: Array<string> = []
  for (const entry of readdirSync(client, { recursive: true })) {
    const path = String(entry)
    if (!/\.(ts|tsx)$/.test(path) || allowed.has(path)) continue
    const source = readFileSync(join(client, path), "utf8")
    if (/\b(?:readPreference|watchPreference)\s*\(/.test(source)) {
      offenders.push(path)
    }
  }
  expect(offenders).toEqual([])
})
