import { expect, test } from "bun:test"

import { visibleViewport } from "./viewport.ts"

test("with no keyboard, nothing is hidden below the visible strip", () => {
  expect(visibleViewport({ height: 844, offsetTop: 0 }, 844)).toEqual({
    height: 844,
    bottom: 0,
  })
})

test("a keyboard is the difference between the two viewports", () => {
  expect(visibleViewport({ height: 508, offsetTop: 0 }, 844)).toEqual({
    height: 508,
    bottom: 336,
  })
})

test("scrolling the visible strip down leaves less hidden below it", () => {
  expect(visibleViewport({ height: 508, offsetTop: 100 }, 844)).toEqual({
    height: 508,
    bottom: 236,
  })
})

test("an over-scrolled page never asks for a negative lift", () => {
  expect(visibleViewport({ height: 800, offsetTop: 120 }, 844).bottom).toBe(0)
})

test("the reading is whole pixels", () => {
  expect(visibleViewport({ height: 507.6, offsetTop: 0.2 }, 844)).toEqual({
    height: 508,
    bottom: 336,
  })
})
