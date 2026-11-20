import { expect, test } from "bun:test"

import { clampedLeft, createTips, liftedTop } from "./tip.ts"

test("a tip that fits is drawn under its anchor", () => {
  expect(clampedLeft(120, 200, 1280)).toBe(120)
})

test("a tip that would overflow is pulled back inside the window", () => {
  expect(clampedLeft(1100, 300, 1280)).toBe(1280 - 300 - 8)
})

test("a tip wider than the window is pinned to the left margin", () => {
  expect(clampedLeft(40, 600, 390)).toBe(8)
})

test("a tip never starts left of the margin", () => {
  expect(clampedLeft(0, 100, 1280)).toBe(8)
})

test("a tip with room below it stays where it was hung", () => {
  expect(liftedTop(100, 28, 800, 40)).toBe(100)
})

test("a tip running past the window's bottom is lifted onto the margin", () => {
  expect(liftedTop(400, 400, 760, 40)).toBe(760 - 400 - 8)
})

test("even a one-line tip in the last pixels is lifted the few it needs", () => {
  expect(liftedTop(740, 28, 760, 40)).toBe(760 - 28 - 8)
})

test("a lift never crosses the bar's floor", () => {
  expect(liftedTop(48, 730, 760, 40)).toBe(40 + 4)
})

test("with no bar, the top pin is the margin itself", () => {
  expect(liftedTop(100, 780, 760, 0)).toBe(8)
})

test("opening a tip closes whichever was open", () => {
  const { takeTip, showTip, hideTip, tipShowing } = createTips()
  const first = takeTip()
  const second = takeTip()

  showTip(first)
  expect(tipShowing(first)).toBe(true)

  showTip(second)
  expect(tipShowing(second)).toBe(true)
  expect(tipShowing(first)).toBe(false)
})

test("a superseded tip cannot close its successor", () => {
  const { takeTip, showTip, hideTip, tipShowing } = createTips()
  const first = takeTip()
  const second = takeTip()

  showTip(first)
  showTip(second)
  hideTip(first)

  expect(tipShowing(second)).toBe(true)
})

test("a tip closes itself while it is the one open", () => {
  const { takeTip, showTip, hideTip, tipShowing } = createTips()
  const only = takeTip()
  showTip(only)
  hideTip(only)
  expect(tipShowing(only)).toBe(false)
})
