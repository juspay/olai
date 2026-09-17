import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { createAlerts } from "./alerts.ts"

test("chat alert preferences follow storage without UI, release listeners and reacquire fresh state", async () => {
  const stored = new Map<string, string>([["olai.alerts", "false"]])
  const listeners = new Set<(event: StorageEvent) => void>()
  const globals = {
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) },
    window: { addEventListener: (_: string, fn: (event: StorageEvent) => void) => listeners.add(fn), removeEventListener: (_: string, fn: (event: StorageEvent) => void) => listeners.delete(fn) },
  }
  const before = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  const first = Scope.makeUnsafe()
  const second = Scope.makeUnsafe()
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
  try {
    const state = await Effect.runPromise(Scope.provide(createAlerts, first))
    expect(state.alertsOn()).toBe(false)
    expect(state.alertSoundOn()).toBe(true)
    expect(listeners.size).toBe(2)
    for (const listener of listeners) listener({ key: "olai.alerts", newValue: "true", storageArea: localStorage } as StorageEvent)
    expect(state.alertsOn()).toBe(true)
    state.setAlertSoundOn(false)
    expect(stored.get("olai.alerts.sound")).toBe("false")
    await Effect.runPromise(Scope.close(first, Exit.void))
    expect(listeners.size).toBe(0)
    expect(() => state.setAlertsOn(false)).toThrow("no longer active")
    stored.set("olai.alerts.sound", "true")
    const next = await Effect.runPromise(Scope.provide(createAlerts, second))
    expect(next).not.toBe(state)
    expect(next.alertSoundOn()).toBe(true)
    expect(state.alertSoundOn()).toBe(false)
    expect(listeners.size).toBe(2)
  } finally {
    await Effect.runPromise(Scope.close(first, Exit.void))
    await Effect.runPromise(Scope.close(second, Exit.void))
    for (const [key, descriptor] of before) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, key)
      else Object.defineProperty(globalThis, key, descriptor)
    }
  }
  expect(listeners.size).toBe(0)
})
