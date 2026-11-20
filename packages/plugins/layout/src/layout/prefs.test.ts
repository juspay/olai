import { createLayoutState, holdLayoutState } from "./live.ts"
import { followLayout } from "./prefs-owner.ts"
import { expect, test } from "bun:test"

import {
  clamp,
  fitSidebar,
  MIN_MAIN_PX,
  parsePx,
  SIDEBAR_DEFAULT_PX,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
  SIDEBAR_WIDTH_KEY,
} from "olai-plugin-layout/preferences"
import { setSidebarWidth } from "./live.ts"
import { parseBool } from "@olai/web/client/preference.ts"
import { remembering } from "@olai/web/client/preference.testlib.ts"

test("clamp holds a value inside its bounds", () => {
  expect(clamp(10, 0, 20)).toBe(10)
  expect(clamp(-5, 0, 20)).toBe(0)
  expect(clamp(99, 0, 20)).toBe(20)
})

test("parseBool treats only the string true as open", () => {
  expect(parseBool(null, true)).toBe(true)
  expect(parseBool(null, false)).toBe(false)
  expect(parseBool("true", false)).toBe(true)
  expect(parseBool("false", true)).toBe(false)
  expect(parseBool("1", false)).toBe(false)
})

test("parsePx clamps and rejects non-numbers", () => {
  expect(parsePx(null, 256, 180, 480)).toBe(256)
  expect(parsePx("300", 256, 180, 480)).toBe(300)
  expect(parsePx("99", 256, 180, 480)).toBe(180)
  expect(parsePx("9999", 256, 180, 480)).toBe(480)
  expect(parsePx("nope", 256, 180, 480)).toBe(256)
  expect(parsePx("12.7", 256, 180, 480)).toBe(180)
})

test("the width setter forwards persist: false, so a pointermove writes nothing", () => {
  remembering((store) => {
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    Object.defineProperty(globalThis, "window", { configurable: true, value: { innerWidth: 1400, addEventListener() {}, removeEventListener() {} } })
    const release = holdLayoutState(createLayoutState())
    const stop = followLayout()
    try {
    setSidebarWidth(300, { persist: false })
    expect(store.size).toBe(0)
    setSidebarWidth(301)
    expect(store.get(SIDEBAR_WIDTH_KEY)).toBe("301")
    } finally {
      stop()
      release()
      if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow)
      else Reflect.deleteProperty(globalThis, "window")
    }
  })
})

test("fitSidebar keeps a main pane on a 600px window at the max stored width", () => {
  const side = fitSidebar(SIDEBAR_MAX_PX, true, 600)
  expect(side + MIN_MAIN_PX).toBeLessThanOrEqual(600)
  expect(side).toBeGreaterThanOrEqual(SIDEBAR_MIN_PX)
})

test("fitSidebar leaves the default alone on a wide screen", () => {
  expect(fitSidebar(SIDEBAR_DEFAULT_PX, true, 1440)).toBe(SIDEBAR_DEFAULT_PX)
})

test("fitSidebar hands a railed column its stored width back untouched", () => {
  expect(fitSidebar(SIDEBAR_MAX_PX, false, 600)).toBe(SIDEBAR_MAX_PX)
})
