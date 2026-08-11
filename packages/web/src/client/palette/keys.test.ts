import { expect, test } from "bun:test"

import { isApplePlatform, matchKey } from "./keys.ts"

const key = (
  k: string,
  mods: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {},
): KeyboardEvent =>
  ({
    key: k,
    metaKey: mods.meta === true,
    ctrlKey: mods.ctrl === true,
    altKey: mods.alt === true,
    shiftKey: mods.shift === true,
  }) as KeyboardEvent

test("on Apple, Meta bindings fire and bare Ctrl does not", () => {
  expect(matchKey(key("k", { meta: true }), "MacIntel")?.action).toBe("palette")
  expect(matchKey(key("k", { ctrl: true }), "MacIntel")).toBeNull()
  expect(matchKey(key("j", { meta: true }), "MacIntel")?.action).toBe("chat")
  expect(matchKey(key("\\", { meta: true }), "MacIntel")?.action).toBe("sidebar")
})

test("elsewhere, Ctrl bindings fire and bare Meta does not", () => {
  expect(matchKey(key("k", { ctrl: true }), "Linux x86_64")?.action).toBe(
    "palette",
  )
  expect(matchKey(key("k", { meta: true }), "Linux x86_64")).toBeNull()
  expect(matchKey(key("j", { ctrl: true }), "Linux x86_64")?.action).toBe("chat")
})

test("shifted and bare keys are ignored", () => {
  expect(matchKey(key("k"), "Linux x86_64")).toBeNull()
  expect(matchKey(key("k", { ctrl: true, shift: true }), "Linux x86_64")).toBeNull()
})

test("isApplePlatform recognises Mac and iOS", () => {
  expect(isApplePlatform("MacIntel")).toBe(true)
  expect(isApplePlatform("iPhone")).toBe(true)
  expect(isApplePlatform("Linux x86_64")).toBe(false)
})
