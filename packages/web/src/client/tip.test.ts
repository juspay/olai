import { expect, test } from "bun:test"

import { clampedLeft, hideTip, showTip, takeTip, tipShowing } from "./tip.ts"

// The ordinary case: a tip starts where the thing it is about starts.
test("a tip that fits is drawn under its anchor", () => {
  expect(clampedLeft(120, 200, 1280)).toBe(120)
})

// The case the browser's own tooltip got wrong, and the reason this exists: a
// tip near the right edge is pulled back until it ends inside the window,
// rather than running off with the end of the sentence outside the screen.
test("a tip that would overflow is pulled back inside the window", () => {
  expect(clampedLeft(1100, 300, 1280)).toBe(1280 - 300 - 8)
})

// A phone, and a tip too wide for it: it is pinned to the left margin. Hanging
// off the RIGHT loses the end of the sentence; hanging off the LEFT loses the
// beginning, which is where reading starts.
test("a tip wider than the window is pinned to the left margin", () => {
  expect(clampedLeft(40, 600, 390)).toBe(8)
})

// The anchor itself can be at the very edge — a mark column on a deeply
// indented row, a window resized under an open tip.
test("a tip never starts left of the margin", () => {
  expect(clampedLeft(0, 100, 1280)).toBe(8)
})

// ── one tip, ever ──────────────────────────────────────────────────────

// The bug this invariant was written for, in one test: a tip whose control
// moved out from under a stationary pointer never hears `mouseleave` — the
// browser fires none for that — so it would be open for good, and the next
// hover put a second one beside it saying the same sentence a few pixels
// away. Opening one closes every other, whatever happened to the first.
test("opening a tip closes whichever was open", () => {
  const first = takeTip()
  const second = takeTip()

  showTip(first)
  expect(tipShowing(first)).toBe(true)

  // `first` never gets its own leave: nothing tells it, and nothing has to.
  showTip(second)
  expect(tipShowing(second)).toBe(true)
  expect(tipShowing(first)).toBe(false)
})

// Closing is about the tip that is open, not about whoever asks: a stale
// closer — a leave arriving after another tip took over, a disposal running
// late — must not take the current one down with it.
test("a superseded tip cannot close its successor", () => {
  const first = takeTip()
  const second = takeTip()

  showTip(first)
  showTip(second)
  hideTip(first)

  expect(tipShowing(second)).toBe(true)
})

test("a tip closes itself while it is the one open", () => {
  const only = takeTip()
  showTip(only)
  hideTip(only)
  expect(tipShowing(only)).toBe(false)
})
