import { expect, test } from "bun:test"

import { parseBool } from "../preference.ts"

import { AUTOCOMMIT_KEY, autoCommit, setAutoCommit } from "./autocommit.ts"

test("the key is namespaced to this browser's git preferences", () => {
  expect(AUTOCOMMIT_KEY).toBe("olai.git.autocommit")
})

test("a browser that has never been asked does not auto-commit", () => {
  expect(parseBool(null, false)).toBe(false)
  expect(autoCommit()).toBe(false)
})

test("only the word this app writes is a pick", () => {
  expect(parseBool("true", false)).toBe(true)
  expect(parseBool("false", false)).toBe(false)
  expect(parseBool("1", false)).toBe(false)
  expect(parseBool("yes", false)).toBe(false)
})

test("a pick is remembered under olai.git.autocommit", () => {
  const store = new Map<string, string>()
  const g = globalThis as Record<string, unknown>
  g.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  try {
    setAutoCommit(true)
    expect(autoCommit()).toBe(true)
    expect(store.get(AUTOCOMMIT_KEY)).toBe("true")
    setAutoCommit(false)
    expect(autoCommit()).toBe(false)
    expect(store.get(AUTOCOMMIT_KEY)).toBe("false")
  } finally {
    delete g.localStorage
  }
})
