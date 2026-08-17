import { expect, test } from "bun:test"

import { ours, splitClick } from "./press.ts"

const press = (
  mods: {
    alt?: boolean
    shift?: boolean
    ctrl?: boolean
    meta?: boolean
    button?: number
    defaultPrevented?: boolean
  } = {},
) => ({
  defaultPrevented: mods.defaultPrevented === true,
  button: mods.button ?? 0,
  metaKey: mods.meta === true,
  ctrlKey: mods.ctrl === true,
  shiftKey: mods.shift === true,
  altKey: mods.alt === true,
})

test("a plain click is ours and not a split", () => {
  expect(ours(press())).toBe(true)
  expect(splitClick(press())).toBeNull()
})

test("Alt+click is a reuse, and is not ours", () => {
  expect(ours(press({ alt: true }))).toBe(false)
  expect(splitClick(press({ alt: true }))).toBe("reuse")
})

test("Alt+Shift+click forces a new pane", () => {
  expect(splitClick(press({ alt: true, shift: true }))).toBe("force")
})

test("Ctrl/Cmd still belong to the browser, even with Alt", () => {
  expect(splitClick(press({ alt: true, ctrl: true }))).toBeNull()
  expect(splitClick(press({ alt: true, meta: true }))).toBeNull()
  expect(ours(press({ ctrl: true }))).toBe(false)
})

test("a press something else already answered is nobody's", () => {
  expect(splitClick(press({ alt: true, defaultPrevented: true }))).toBeNull()
  expect(ours(press({ defaultPrevented: true }))).toBe(false)
})
