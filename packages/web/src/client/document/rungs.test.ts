/**
 * The two-rung height rule, as a state machine rather than as a race.
 *
 * PR #201 named this as a coverage gap and left it: the rule lived inside
 * `./Hypertext.tsx`, this client has no harness that mounts a component, and
 * the only way to reach it was to drive a browser at a page whose picture had
 * to be HELD BACK by a Playwright route so the reading order would be the one
 * under test rather than whichever one a kilobyte over loopback happened to
 * win. Those scenarios are still the proof that a frame ends up the height of
 * what is in it — a browser is the only thing that can say that — but the rule
 * they exercise is a counter with four states, and a counter should be
 * checkable by counting.
 *
 * The three claims, and the third is the one the rule exists for:
 *
 *   - **each kind is taken once** at a given width, however many times it is
 *     reported;
 *   - **the two kinds are independent**, which is what lets a page grow by
 *     exactly the height its pictures turned out to be and no further;
 *   - **a new width opens both again**, because a reflow is a real answer to a
 *     new question — and everything else is refused, which is what a page sized
 *     in `vh` meets when it tries to climb its own ladder.
 */

import { describe, expect, test } from "bun:test"

import { rungs } from "./rungs.ts"

describe("a frame's height reports", () => {
  test("are taken once per kind at one width, however many arrive", () => {
    const heights = rungs()
    expect(heights.takes("arriving", 800)).toBe(true)
    expect(heights.takes("arriving", 800)).toBe(false)
    expect(heights.takes("arriving", 800)).toBe(false)
    // The settled reading is a different question and has its own rung.
    expect(heights.takes("settled", 800)).toBe(true)
    expect(heights.takes("settled", 800)).toBe(false)
  })

  test("do not have to arrive in either order", () => {
    const heights = rungs()
    expect(heights.takes("settled", 800)).toBe(true)
    expect(heights.takes("arriving", 800)).toBe(true)
    expect(heights.takes("settled", 800)).toBe(false)
    expect(heights.takes("arriving", 800)).toBe(false)
  })

  // The ladder, refused. A page whose height IS the frame's height reports a
  // taller number every time the frame grows, and the width never changes
  // because nothing about the window moved — so every report after the first
  // two is somebody measuring their own reflection.
  test("stop at two rungs when a page sized in viewport units keeps reporting", () => {
    const heights = rungs()
    const taken = [
      heights.takes("arriving", 900),
      heights.takes("settled", 900),
      ...Array.from({ length: 20 }, (_, at) =>
        heights.takes(at % 2 === 0 ? "arriving" : "settled", 900)),
    ]
    expect(taken.filter(Boolean)).toHaveLength(2)
  })

  // …and a reflow is not the ladder. The window really did change, so the page
  // really does have a new height, and both kinds are open again.
  test("open again at a new width, and only at a new one", () => {
    const heights = rungs()
    expect(heights.takes("arriving", 800)).toBe(true)
    expect(heights.takes("settled", 800)).toBe(true)
    expect(heights.takes("arriving", 640)).toBe(true)
    expect(heights.takes("settled", 640)).toBe(true)
    expect(heights.takes("arriving", 640)).toBe(false)
  })

  // The record holds the LAST width each kind was taken at, not every width it
  // has ever seen, so a window dragged back to a size it had before opens both
  // rungs again. That is the right answer and not a leak: the ladder is a page
  // reporting a NEW height at an UNCHANGED width, and a window that really went
  // 800 → 640 → 800 really did reflow twice. Held here because a set-shaped
  // record would read as the more careful choice and would refuse the second
  // reflow.
  test("and a window dragged back to a width it had is a reflow, not a rung", () => {
    const heights = rungs()
    expect(heights.takes("arriving", 800)).toBe(true)
    expect(heights.takes("arriving", 640)).toBe(true)
    expect(heights.takes("arriving", 800)).toBe(true)
    expect(heights.takes("arriving", 800)).toBe(false)
  })

  // What `fresh()` is for: the frame is being pointed at another document, and
  // the heights belonged to the one that is leaving. Without this the next
  // file would be drawn at the last one's height, at every width the last one
  // had already spent.
  test("start over for the next document, at every width", () => {
    const heights = rungs()
    heights.takes("arriving", 800)
    heights.takes("settled", 800)
    heights.fresh()
    expect(heights.takes("arriving", 800)).toBe(true)
    expect(heights.takes("settled", 800)).toBe(true)
  })

  test("and two frames do not share a record", () => {
    const one = rungs()
    const other = rungs()
    expect(one.takes("arriving", 800)).toBe(true)
    expect(other.takes("arriving", 800)).toBe(true)
  })
})
