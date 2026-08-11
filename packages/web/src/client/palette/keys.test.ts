import { expect, test } from "bun:test"

import { matchKey } from "./keys.ts"

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

test("⌘K and Ctrl+K open the palette", () => {
  expect(matchKey(key("k", { meta: true }))?.action).toBe("palette")
  expect(matchKey(key("K", { ctrl: true }))?.action).toBe("palette")
})

test("⌘\\ toggles the sidebar", () => {
  expect(matchKey(key("\\", { meta: true }))?.action).toBe("sidebar")
  expect(matchKey(key("\\", { ctrl: true }))?.action).toBe("sidebar")
})

test("⌘J toggles chat", () => {
  expect(matchKey(key("j", { meta: true }))?.action).toBe("chat")
  expect(matchKey(key("j", { ctrl: true }))?.action).toBe("chat")
})

test("bare keys and shifted combos are ignored", () => {
  expect(matchKey(key("k"))).toBeNull()
  expect(matchKey(key("k", { meta: true, shift: true }))).toBeNull()
  expect(matchKey(key("k", { meta: true, alt: true }))).toBeNull()
})
