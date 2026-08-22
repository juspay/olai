import { expect, test } from "bun:test"

import { parseBool } from "../preference.ts"

import { NO_PIN } from "@olai/format"

import { AUTOPUSH_KEY, autoPush, setAutoPush, storedAutoPush } from "./autopush.ts"
import { setPinned } from "./pinned.ts"

test("the key is namespaced to this browser's git preferences", () => {
  expect(AUTOPUSH_KEY).toBe("olai.git.autopush")
})

test("a browser that has never been asked does not auto-push", () => {
  expect(parseBool(null, false)).toBe(false)
  expect(autoPush()).toBe(false)
})

test("only the word this app writes is a pick", () => {
  expect(parseBool("true", false)).toBe(true)
  expect(parseBool("false", false)).toBe(false)
  expect(parseBool("1", false)).toBe(false)
  expect(parseBool("yes", false)).toBe(false)
})

test("a pick is remembered under olai.git.autopush", () => {
  const store = new Map<string, string>()
  const g = globalThis as Record<string, unknown>
  g.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  try {
    setAutoPush(true)
    expect(autoPush()).toBe(true)
    expect(store.get(AUTOPUSH_KEY)).toBe("true")
    setAutoPush(false)
    expect(autoPush()).toBe(false)
    expect(store.get(AUTOPUSH_KEY)).toBe("false")
  } finally {
    delete g.localStorage
  }
})

/** ── what the server pinned ─────────────────────────────────────────────
 *
 *  `--push`, and the argument is `./autocommit.test.ts`'s one door over and
 *  sharper: whether a branch is pushed is the least personal thing on this
 *  panel, and in a team deployment it is not one colleague's browser's to
 *  decide. The stored pick is worn over, never written. */
test("a pinned --push overrules this browser without overwriting it", () => {
  const store = new Map<string, string>()
  const g = globalThis as Record<string, unknown>
  g.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  try {
    setAutoPush(false)
    setPinned({ commit: null, push: "auto" })
    expect(autoPush()).toBe(true)
    expect(storedAutoPush()).toBe(false)

    setAutoPush(true)
    setPinned({ commit: null, push: "off" })
    expect(autoPush()).toBe(false)
    expect(store.get(AUTOPUSH_KEY)).toBe("true")

    setPinned(NO_PIN)
    expect(autoPush()).toBe(true)
  } finally {
    setPinned(NO_PIN)
    delete g.localStorage
  }
})

/** A commit pinned alone leaves this row this browser's, so an operator who
 *  ruled on committing has not silently ruled on pushing to a shared branch. */
test("pinning --commit alone leaves Git push to the browser", () => {
  setAutoPush(false)
  setPinned({ commit: "auto", push: null })
  try {
    expect(autoPush()).toBe(false)
    setAutoPush(true)
    expect(autoPush()).toBe(true)
  } finally {
    setAutoPush(false)
    setPinned(NO_PIN)
  }
})
