import { expect, test } from "bun:test"
import { runInNewContext } from "node:vm"
import assets from "./assets.ts"

const bootstrap = assets.head.match(/<script>([\s\S]*?)<\/script>/)?.[1]

test("first-paint bootstrap applies all stored choices before runtime activation", () => {
  expect(bootstrap).toBeDefined()
  const attributes = new Map<string, string>()
  const stored = new Map([["olai.theme", "pitch"], ["olai.font", "system"], ["olai.size", "larger"]])
  runInNewContext(bootstrap!, {
    localStorage: { getItem: (key: string) => stored.get(key) },
    document: { documentElement: { setAttribute: (key: string, value: string) => attributes.set(key, value) } },
  })
  expect(Object.fromEntries(attributes)).toEqual({ "data-theme": "pitch", "data-font": "system", "data-size": "larger" })
})

test("unavailable storage leaves first paint usable", () => {
  const writes: unknown[] = []
  expect(() => runInNewContext(bootstrap!, {
    localStorage: { getItem: () => { throw new Error("storage denied") } },
    document: { documentElement: { setAttribute: (...args: unknown[]) => writes.push(args) } },
  })).not.toThrow()
  expect(writes).toEqual([])
})
