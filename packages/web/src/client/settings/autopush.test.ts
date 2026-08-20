import { expect, test } from "bun:test"

import { parseBool } from "../preference.ts"

import { AUTOPUSH_KEY, autoPush, setAutoPush } from "./autopush.ts"

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
