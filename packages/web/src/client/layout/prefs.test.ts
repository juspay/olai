import { expect, test } from "bun:test"

import {
  CHAT_DEFAULT_PX,
  CHAT_MAX_PX,
  CHAT_MIN_PX,
  CHAT_WIDTH_KEY,
  clamp,
  fitWidths,
  MIN_MAIN_PX,
  parsePx,
  parseSnap,
  RAIL_WIDTH_PX,
  setChatWidth,
  setSidebarWidth,
  SIDEBAR_DEFAULT_PX,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
  SIDEBAR_WIDTH_KEY,
} from "./prefs.ts"
import { parseBool } from "../preference.ts"
import { remembering } from "../preference.testlib.ts"

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
  // 12.7 rounds to 13, then clamps up to the min.
  expect(parsePx("12.7", 256, 180, 480)).toBe(180)
})

test("parseSnap only accepts full; everything else is half", () => {
  expect(parseSnap("full")).toBe("full")
  expect(parseSnap(null)).toBe("half")
  expect(parseSnap("half")).toBe("half")
  expect(parseSnap("whatever")).toBe("half")
})

test("the width setters forward persist: false, so a pointermove writes nothing", () => {
  // The factory's own test proves `set` honours the option; this one holds
  // the hop in front of it — a setter that stopped forwarding `opts` would
  // turn every pointermove of a drag into a storage write while the factory
  // test stayed green. Storage is shimmed for the duration; bun's runner has
  // none, and `readPreference` reads that absence as null either way.
  remembering((store) => {
    setSidebarWidth(300, { persist: false })
    setChatWidth(300, { persist: false })
    expect(store.size).toBe(0)
    setSidebarWidth(301)
    setChatWidth(302)
    expect(store.get(SIDEBAR_WIDTH_KEY)).toBe("301")
    expect(store.get(CHAT_WIDTH_KEY)).toBe("302")
  })
})

test("fitWidths keeps a main pane on a 1024px laptop at max stored widths", () => {
  const { side, chat } = fitWidths(
    SIDEBAR_MAX_PX,
    CHAT_MAX_PX,
    true,
    true,
    1024,
  )
  expect(side + chat + MIN_MAIN_PX).toBeLessThanOrEqual(1024)
  expect(side).toBeGreaterThanOrEqual(SIDEBAR_MIN_PX)
  expect(chat).toBeGreaterThanOrEqual(CHAT_MIN_PX)
})

test("fitWidths leaves defaults alone on a wide screen", () => {
  const { side, chat } = fitWidths(
    SIDEBAR_DEFAULT_PX,
    CHAT_DEFAULT_PX,
    true,
    true,
    1440,
  )
  expect(side).toBe(SIDEBAR_DEFAULT_PX)
  expect(chat).toBe(CHAT_DEFAULT_PX)
})

test("fitWidths with chat only leaves room for the rail", () => {
  const { chat } = fitWidths(SIDEBAR_DEFAULT_PX, CHAT_MAX_PX, false, true, 600)
  expect(chat + RAIL_WIDTH_PX + MIN_MAIN_PX).toBeLessThanOrEqual(600)
})
