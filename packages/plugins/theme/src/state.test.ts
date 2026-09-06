import { expect, spyOn, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { createAppearance } from "./state.ts"

import { browser, close } from "./state.testlib.ts"

test("appearance survives without preferences UI, releases observers and metadata, and returns with fresh state", () => browser(async ({ root, meta, icon, stored, listeners, created, revoked }) => {
  const first = Scope.makeUnsafe()
  try {
    const state = await Effect.runPromise(Scope.provide(createAppearance, first))
    expect(state.theme.current().name).toBe("pitch")
    state.chrome.name("olai [test]")
    state.chrome.waiting(true)
    expect(document.title).toBe("● olai [test]")
    expect(state.font.current().name).toBe("system")
    expect(state.size.current().name).toBe("larger")
    expect(listeners.size).toBe(3)
    for (const listener of listeners) listener({ key: "olai.size", newValue: "medium", storageArea: localStorage } as StorageEvent)
    expect(state.size.current().name).toBe("medium")
    await close(first)
    expect(listeners.size).toBe(0)
    expect(document.title).toBe("olai")
    expect(() => state.chrome.waiting(true)).toThrow("no longer active")
    expect(root.getAttribute("data-theme")).toBe("inherited")
    expect(root.getAttribute("data-size")).toBeNull()
    expect(meta.getAttribute("content")).toBe("original-color")
    expect(icon.getAttribute("href")).toBe("/original.svg")
    expect(revoked).toEqual(created)
    expect(() => state.size.pick(state.size.current())).toThrow("no longer active")
    stored.set("olai.theme", "reef")
    stored.set("olai.size", "large")
    const second = Scope.makeUnsafe()
    try {
      const next = await Effect.runPromise(Scope.provide(createAppearance, second))
      expect(next).not.toBe(state)
      expect(next.theme.current().name).toBe("reef")
      expect(next.size.current().name).toBe("large")
      expect(listeners.size).toBe(3)
    } finally { await close(second) }
    expect(revoked).toEqual(created)
  } finally { await close(first) }
}))

test("unknown stored choices are forgotten and a failed initialization releases its chrome claim", () => browser(async ({ root, stored, listeners }) => {
  stored.set("olai.theme", "unknown")
  stored.set("olai.font", "unknown")
  stored.set("olai.size", "unknown")
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const state = yield* createAppearance
    expect(stored.size).toBe(0)
    expect(state.theme.current().name).toBe("reef")
    expect(root.getAttribute("data-theme")).toBeNull()
  })))
  const create = spyOn(URL, "createObjectURL")
  create.mockImplementationOnce(() => { throw new Error("icon failed") })
  const failed = await Effect.runPromise(Effect.exit(Effect.scoped(createAppearance)))
  expect(Exit.isFailure(failed)).toBe(true)
  expect(listeners.size).toBe(0)
  await Effect.runPromise(Effect.scoped(createAppearance))
  expect(listeners.size).toBe(0)
}))
