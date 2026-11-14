import { expect, spyOn, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { createAppearance } from "./state.ts"

import { browser, close } from "./state.testlib.ts"

test("appearance survives without preferences UI, releases observers and metadata, and returns with fresh state", () => browser(async ({ root, meta, darkMeta, icon, canvas, stored, listeners, created, revoked }) => {
  const first = Scope.makeUnsafe()
  try {
    const state = await Effect.runPromise(Scope.provide(createAppearance, first))
    expect(state.theme.current().name).toBe("basalt")
    expect(state.theme.following()).toBe(false)
    // The pick is dark, so the canvas meta is pinned dark and the word is
    // left beside the pick for the next load's boot script to copy — which is
    // the whole of what stops a dark palette spending the pre-sheet window in
    // a light browser's chrome.
    expect(canvas.getAttribute("content")).toBe("dark")
    expect(stored.get("olai.scheme")).toBe("dark")
    // BOTH chrome metas, because the browser uses the first whose media
    // matches and a dark pick under a light OS matches the other one: the
    // page is one colour whatever the OS says, so both say that colour.
    const paper = state.theme.current().colors.paper
    expect(meta.getAttribute("content")).toBe(paper)
    expect(darkMeta.getAttribute("content")).toBe(paper)
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
    expect(darkMeta.getAttribute("content")).toBe("original-dark-color")
    expect(meta.getAttribute("media")).toBe("(prefers-color-scheme: light)")
    expect(icon.getAttribute("href")).toBe("/original.svg")
    // Inherited, not authored: withdrawal owes back the word it found.
    expect(canvas.getAttribute("content")).toBe("light dark")
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
      expect(canvas.getAttribute("content")).toBe("light")
      expect(stored.get("olai.scheme")).toBe("light")
      expect(listeners.size).toBe(3)
    } finally { await close(second) }
    expect(revoked).toEqual(created)
  } finally { await close(first) }
}))

test("unknown stored choices are forgotten and a failed initialization releases its chrome claim", () => browser(async ({ root, canvas, stored, listeners }) => {
  stored.set("olai.theme", "unknown")
  stored.set("olai.font", "unknown")
  stored.set("olai.size", "unknown")
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const state = yield* createAppearance
    expect(stored.size).toBe(0)
    expect(state.theme.current().name).toBe("chalk")
    expect(state.theme.following()).toBe(true)
    expect(root.getAttribute("data-theme")).toBeNull()
    // Nothing picked: the canvas stays BOTH, which is the word for "ask the
    // OS" — and nothing is stored, so the next load's shell says it too.
    expect(canvas.getAttribute("content")).toBe("light dark")
    state.theme.pick(state.theme.current())
    expect(state.theme.following()).toBe(false)
    expect(root.getAttribute("data-theme")).toBe("chalk")
    expect(stored.get("olai.theme")).toBe("chalk")
    expect(canvas.getAttribute("content")).toBe("light")
    expect(stored.get("olai.scheme")).toBe("light")
    state.theme.follow()
    expect(state.theme.following()).toBe(true)
    expect(root.getAttribute("data-theme")).toBeNull()
    expect(stored.has("olai.theme")).toBe(false)
    expect(canvas.getAttribute("content")).toBe("light dark")
    expect(stored.has("olai.scheme")).toBe(false)
  })))
  const create = spyOn(URL, "createObjectURL")
  create.mockImplementationOnce(() => { throw new Error("icon failed") })
  const failed = await Effect.runPromise(Effect.exit(Effect.scoped(createAppearance)))
  expect(Exit.isFailure(failed)).toBe(true)
  expect(listeners.size).toBe(0)
  await Effect.runPromise(Effect.scoped(createAppearance))
  expect(listeners.size).toBe(0)
}))
