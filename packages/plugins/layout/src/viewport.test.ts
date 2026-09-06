import { expect, test } from "bun:test"

import { visibleViewport } from "./viewport.ts"

// A phone with nothing in the way: the visible strip IS the layout viewport,
// so nothing is hidden below it and a bottom-anchored box needs no lift.
test("with no keyboard, nothing is hidden below the visible strip", () => {
  expect(visibleViewport({ height: 844, offsetTop: 0 }, 844)).toEqual({
    height: 844,
    bottom: 0,
  })
})

// The keyboard: the layout viewport is unchanged (this is the case
// `interactive-widget=resizes-content` exists for and iOS ignores), the
// visible one is shorter, and the difference is exactly what a fixed box has
// to be lifted by to stay on screen.
test("a keyboard is the difference between the two viewports", () => {
  expect(visibleViewport({ height: 508, offsetTop: 0 }, 844)).toEqual({
    height: 508,
    bottom: 336,
  })
})

// Scrolled with the keyboard up: the strip has moved down the layout viewport
// without changing size, so less of the page is hidden beneath it.
test("scrolling the visible strip down leaves less hidden below it", () => {
  expect(visibleViewport({ height: 508, offsetTop: 100 }, 844)).toEqual({
    height: 508,
    bottom: 236,
  })
})

// Over-scroll (rubber-banding) can put the visible strip past the bottom of
// the layout viewport. The arithmetic goes negative there, and a negative lift
// would push the thing it is lifting off the bottom of the screen.
test("an over-scrolled page never asks for a negative lift", () => {
  expect(visibleViewport({ height: 800, offsetTop: 120 }, 844).bottom).toBe(0)
})

// These end up in CSS, where a sub-pixel change is a style recalc for every
// node on the page that moves nothing anyone can see.
test("the reading is whole pixels", () => {
  expect(visibleViewport({ height: 507.6, offsetTop: 0.2 }, 844)).toEqual({
    height: 508,
    bottom: 336,
  })
})
