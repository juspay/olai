import { expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  createPreference,
  preferenceChanged,
  type PreferenceCodec,
} from "./preference.ts"

const KEY = "olai.theme"

/** What a browser hands a `storage` listener, as much of it as this decision
 *  reads. A literal rather than a real `StorageEvent`, because the two fields
 *  below ARE the input — a constructed event would be the same two fields with
 *  a ceremony in front of them, and the runner has no `StorageEvent` anyway. */
const said = (key: string | null, newValue: string | null): StorageEvent =>
  ({ key, newValue }) as StorageEvent

test("another tab's pick under this key is the new value", () => {
  expect(preferenceChanged(said(KEY, "pitch"), KEY)).toBe("pitch")
})

test("another tab forgetting it is null, which is a value and not a silence", () => {
  expect(preferenceChanged(said(KEY, null), KEY)).toBeNull()
})

// The case that is easy to miss, and it is not hypothetical: `localStorage
// .clear()` fires ONE event naming no key, and every preference this browser
// held is gone. Read as "not about me", it would leave the tab that cleared
// nothing and every sibling tab still painted in a theme that is no longer
// stored anywhere.
test("a cleared storage names no key, and clears this one too", () => {
  expect(preferenceChanged(said(null, null), KEY)).toBeNull()
})

test("somebody else's key is not this preference", () => {
  expect(preferenceChanged(said("olai.chat.open", "true"), KEY)).toBeUndefined()
  expect(preferenceChanged(said("theme", "pitch"), KEY)).toBeUndefined()
})

// ── the circuit ───────────────────────────────────────────────────────────

/**
 * The circuit's two globals, present for one test and gone after it: bun's
 * runner has neither `localStorage` nor `window`, which is exactly what makes
 * the whole read→signal→write→watch loop testable here — the storage is a
 * `Map` this test can inspect, and "another tab wrote" is `fire`, the
 * listener handed what a real `storage` event would carry.
 */
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

/** A codec with all three behaviours worth exercising: a default for the
 *  entry nobody wrote, a plain print, and `null` — the key removed — for the
 *  value that IS the default. */
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
  // The drag handles' option: a pointermove moves the panel, and only the
  // pointerup writes.
  wired({ "olai.word": "fancy" }, (_fire, store) => {
    const pref = createPreference("olai.word", word)
    pref.set("passing", { persist: false })
    expect(pref.value()).toBe("passing")
    expect(store.get("olai.word")).toBe("fancy")
  })
})

test("stored() is the entry as it is NOW, not as this tab last saw it", () => {
  // The fold memory's read: a sibling tab may have written since, and a write
  // that merges has to start from what is actually there.
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
    // A removal — and a cleared storage, which names no key — is the default
    // again, not a value to guess at.
    fire(null, null)
    expect(pref.value()).toBe("plain")
    // Somebody else's key moves nothing here.
    fire("olai.other", "loud")
    expect(pref.value()).toBe("plain")
  })
})

// ── the claim ─────────────────────────────────────────────────────────────

test("no client file outside this module and the theme spells the circuit's read or watch", () => {
  // The receptacle's grip, as a fact the suite holds rather than a doctrine a
  // review remembers: every stored value runs on `createPreference`, so the
  // primitives' read and watch are spelled here, in this test, and in the two
  // files whose first read belongs to the shell's boot script
  // (`theme/state.ts`, `theme/fontState.ts`, `theme/sizeState.ts`) and which
  // therefore keep their own wiring (preference.ts says why) — and NOWHERE
  // else. A hand-wired circuit has to read before it can do anything else, so
  // this is the test a new one fails — the moment to reach for the factory
  // instead. (The scan grips exactly what the ratified claim names: the read
  // and the watch, not the write, whose callers outside the factory are the
  // theme's own.)
  //
  // The THIRD exception is the type size, and it is on the list for the same
  // reason the first two are rather than by analogy: `<html data-size>` is what
  // the sheet keys off, the shell's boot script writes it before any module
  // exists, and a size taken up after the first paint would reflow the whole
  // page under a reader who had just opened it.
  const allowed = new Set([
    "preference.ts",
    "preference.test.ts",
    "theme/state.ts",
    "theme/fontState.ts",
    "theme/sizeState.ts",
  ])
  const client = import.meta.dir
  const offenders: Array<string> = []
  for (const entry of readdirSync(client, { recursive: true })) {
    const path = String(entry)
    if (!/\.(ts|tsx)$/.test(path) || allowed.has(path)) continue
    const source = readFileSync(join(client, path), "utf8")
    // Word-bounded, and tolerant of space before the paren, so a call is a
    // call however it is formatted — while `myReadPreference(` stays somebody
    // else's name.
    if (/\b(?:readPreference|watchPreference)\s*\(/.test(source)) {
      offenders.push(path)
    }
  }
  expect(offenders).toEqual([])
})
