import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { createRemindersState } from "./said.ts"

test("reminder choices and said follow other tabs, retain the day and release their listeners and setters", async () => {
  const stored = new Map<string, string>()
  const listeners = new Set<(event: StorageEvent) => void>()
  const globals = {
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) },
    window: { addEventListener: (_: string, fn: (event: StorageEvent) => void) => listeners.add(fn), removeEventListener: (_: string, fn: (event: StorageEvent) => void) => listeners.delete(fn) },
  }
  const before = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  const first = Scope.makeUnsafe(), second = Scope.makeUnsafe()
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  try {
    const state = await Effect.runPromise(Scope.provide(createRemindersState, first))
    expect(state.on()).toBe(true); expect(state.said()).toBeNull(); expect(listeners.size).toBe(2)
    state.say("2026-09-11"); state.setOn(false)
    expect(stored.get("olai.reminders.said")).toBe("2026-09-11")
    expect(stored.get("olai.reminders")).toBe("false")
    for (const listener of listeners) listener({ key: "olai.reminders.said", newValue: "2026-09-12" } as StorageEvent)
    expect(state.said()).toBe("2026-09-12")
    for (const listener of listeners) listener({ key: "olai.reminders", newValue: "true" } as StorageEvent)
    expect(state.on()).toBe(true)
    await Effect.runPromise(Scope.close(first, Exit.void))
    expect(listeners.size).toBe(0)
    expect(() => state.say("2026-09-13")).toThrow("no longer active")
    expect(() => state.setOn(true)).toThrow("no longer active")
    const next = await Effect.runPromise(Scope.provide(createRemindersState, second))
    expect(next.said()).toBe("2026-09-11"); expect(next.on()).toBe(false)
    for (const listener of listeners) listener({ key: "olai.reminders.said", newValue: "invalid" } as StorageEvent)
    expect(next.said()).toBeNull()
    for (const listener of listeners) listener({ key: null, newValue: null } as StorageEvent)
    expect(next.on()).toBe(true); expect(next.said()).toBeNull()
  } finally {
    await Effect.runPromise(Scope.close(first, Exit.void)); await Effect.runPromise(Scope.close(second, Exit.void))
    for (const [key, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
  expect(listeners.size).toBe(0)
})
