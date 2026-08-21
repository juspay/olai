/**
 * The frame's own height, coming back — as a subtraction rather than as a race.
 *
 * PR #201 named this as a coverage gap and left it: the rule lived inside
 * `./Hypertext.tsx`, this client has no harness that mounts a component, and
 * the only way to reach it was to drive a browser at a page whose picture had
 * to be HELD BACK by a Playwright route so the reading order would be the one
 * under test rather than whichever one a kilobyte over loopback happened to
 * win. Those scenarios are still the proof that a frame ends up the height of
 * what is in it — a browser is the only thing that can say that — but the rule
 * they exercise is arithmetic over two numbers, and arithmetic should be
 * checkable by doing it.
 *
 * The three claims, and the first is the one the rule exists for:
 *
 *   - **a page that really grew is followed**, however late it grows and
 *     however many times — which is what a chart drawn from a fetch, a
 *     `<details>` a reader opens and a `loading="lazy"` picture all are;
 *   - **a page riding the frame is refused**, because its gap over the frame
 *     never changes: grow the box by sixteen pixels and it says sixteen more;
 *   - **a reader may return to a height they left**, which is why nothing here
 *     remembers a height it has already answered.
 */

import { describe, expect, test } from "bun:test"

import { echo } from "./echo.ts"

/**
 * A frame's worth of reports, said one paint apart — which is the fastest a
 * page can talk (the measure in there reports at most once a paint, and the
 * component answers at most once a paint).
 *
 * A CLOCK OF ITS OWN rather than the real one: the rule takes the time as an
 * argument precisely so a test can say when, and every claim below about the
 * bound is a claim about how fast a page is talking.
 */
const reporting = () => {
  const heights = echo()
  let at = 0
  return {
    fresh: () => heights.fresh(),
    /** One report, a paint after the last. */
    says: (height: number, frame: number) => heights.takes({ height, frame, at: (at += 16) }),
    /** One report after a pause long enough to be a person rather than a loop. */
    later: (height: number, frame: number) =>
      heights.takes({ height, frame, at: (at += 1500) }),
  }
}

describe("a frame's height reports", () => {
  // THE DEFECT THIS RULE CLOSES. A page loads short, the frame is set to what
  // it said, and then it grows — a picture whose bytes were late, a script that
  // drew after `load`, a section the reader opened. The frame follows every
  // time, because each growth is a page standing a different distance above
  // the box it is in.
  test("follow a page that grows after it has loaded, however often", () => {
    const heights = reporting()
    // The first reading, taken inside the `70dvh` guess.
    expect(heights.says(400, 630)).toBe(true)
    // The picture lands, in a frame that is now 400 tall.
    expect(heights.says(900, 400)).toBe(true)
    // …and the reader opens a section, in a frame that is now 900.
    expect(heights.says(1500, 900)).toBe(true)
  })

  // …and a page that SHRANK is a page that changed too: a reader closing the
  // section they opened is not the frame talking to itself.
  test("follow a page that shrinks again", () => {
    const heights = reporting()
    expect(heights.says(1500, 630)).toBe(true)
    expect(heights.says(900, 1500)).toBe(true)
    expect(heights.says(1500, 900)).toBe(true)
  })

  // THE LADDER, REFUSED, and this is the shape it really has. A page sized in
  // `vh` is the frame's height PLUS whatever else is on it — body margins, a
  // heading above the wrapper — so its report is never the frame's own number
  // back. What never changes is the DISTANCE: sixteen pixels above the box, at
  // every height the box is ever given.
  test("refuse a page whose height is the frame's, at whatever distance", () => {
    const heights = reporting()
    // One rung, because nothing has been heard yet and every page is honest
    // until it has said something twice.
    expect(heights.says(646, 630)).toBe(true)
    // …and then it is measuring its own reflection: the frame grew by sixteen
    // and so did it.
    expect(heights.says(662, 646)).toBe(false)
    expect(heights.says(662, 646)).toBe(false)
  })

  // The same page, with no margin at all: the report IS the frame's height, and
  // acting on it would be setting a box to the size it already is.
  test("refuse a page that reports the frame's own height back", () => {
    const heights = reporting()
    expect(heights.says(630, 630)).toBe(true)
    expect(heights.says(630, 630)).toBe(false)
  })

  // A whole `vh` page's traffic, counted. Every report after the first says the
  // same thing about the page and a bigger number about the frame, and the
  // frame is set once rather than climbing to the clamp.
  test("stop after one rung when a page sized in viewport units keeps reporting", () => {
    const heights = reporting()
    let frame = 630
    const taken = Array.from({ length: 20 }, () => {
      // The page is the frame plus a heading and two body margins, always.
      const said = frame + 96
      const took = heights.says(said, frame)
      if (took) frame = said
      return took
    })
    expect(taken.filter(Boolean)).toHaveLength(1)
    expect(frame).toBe(726)
  })

  // Two readings a rounded pixel apart are one reading: the tape measure rounds
  // a fractional layout up and the frame's own height is rounded at the other
  // end, so an exact comparison would refuse to refuse the ladder.
  test("read a gap a rounded pixel out as the same gap", () => {
    const heights = reporting()
    expect(heights.says(646, 630)).toBe(true)
    expect(heights.says(663, 646)).toBe(false)
  })

  // WHAT IS NOT REMEMBERED, and this is the reason there is only one number in
  // here. A reader opening a section, closing it and opening it again puts the
  // page back at a height it has already reported — twice — and every one of
  // those three is a frame that has to follow. A record of heights already
  // answered would refuse the third.
  test("let a reader return to a height they left", () => {
    const heights = reporting()
    expect(heights.says(400, 630)).toBe(true)
    expect(heights.says(1200, 400)).toBe(true)
    expect(heights.says(400, 1200)).toBe(true)
    expect(heights.says(1200, 400)).toBe(true)
  })

  // A reflow at a new width needs no rule of its own: a page laid out narrower
  // is a page of a different height, so its gap over the frame is a different
  // number and it is taken like any other honest change.
  test("follow a reflow without being told the width changed", () => {
    const heights = reporting()
    expect(heights.says(400, 630)).toBe(true)
    expect(heights.says(700, 400)).toBe(true)
  })

  // What `fresh()` is for: the frame is being pointed at another document, and
  // the gap belonged to the one that is leaving. Without this the next file's
  // first reading would be compared against a distance measured in a page that
  // is no longer there.
  test("start over for the next document", () => {
    const heights = reporting()
    expect(heights.says(646, 630)).toBe(true)
    expect(heights.says(662, 646)).toBe(false)
    heights.fresh()
    expect(heights.says(662, 646)).toBe(true)
  })

  // THE BOUND, and what it is for. A page whose height moves the OPPOSITE way
  // from the frame — an element taller when its viewport is shorter, or a page
  // simply posting two heights in a loop — sends a different gap every time, so
  // the rule above never refuses it: it flips, the frame follows, it flips back,
  // and neither ever runs out of room the way a page asking for more than the
  // frame's height does. Under the count that replaced this, impossible. Under
  // the gap alone, a frame flickering for as long as the preview is open.
  test("stop following a page that keeps sending the frame back the other way", () => {
    const heights = reporting()
    const taken = Array.from({ length: 40 }, (_, at) =>
      at % 2 === 0 ? heights.says(1200, 400) : heights.says(400, 1200))
    // The turns are spent and then it is over — not a flicker every paint for
    // as long as somebody has the file open.
    expect(taken.filter(Boolean).length).toBeLessThan(10)
    expect(taken.slice(-8).filter(Boolean)).toHaveLength(0)
  })

  // …and the bound does not reach a person. A reader opening a section, closing
  // it and opening it again turns the frame every press, and a press is nowhere
  // near a paint away from the last one — so their count starts again each time
  // and the frame follows every one of them, however long they keep it up.
  test("follow a reader who toggles a section all afternoon", () => {
    const heights = reporting()
    const taken = Array.from({ length: 40 }, (_, at) =>
      at % 2 === 0 ? heights.later(1200, 400) : heights.later(400, 1200))
    expect(taken.filter(Boolean)).toHaveLength(40)
  })

  // The other half of why the bound is safe: it counts TURNS and not reports.
  // A page whose pictures land one after another pushes the frame the same way
  // every time, so twenty late pictures a paint apart turn nothing and every
  // one of them is followed — which is what the count this replaced could not
  // do at any speed.
  test("follow a page whose pictures land one after another, however many", () => {
    const heights = reporting()
    let frame = 96
    const taken = Array.from({ length: 20 }, (_, at) => {
      // Pictures of unequal heights, which is what pictures are. The equal case
      // is the one below, and it is the rule's stated cost rather than the
      // bound's doing.
      const said = 200 + 11 * at * (at + 7)
      const took = heights.says(said, frame)
      if (took) frame = said
      return took
    })
    expect(taken.filter(Boolean)).toHaveLength(20)
  })

  // THE COST, pinned rather than merely written down. A page that grows by
  // EXACTLY as much as the frame just grew sends the same pair of numbers a
  // page riding the frame sends — the gap does not move — so it loses that
  // step. It wins it back at the next report out of step, which is what the
  // second half of this asserts: the frame ends up following, one beat behind.
  test("lose the step a page takes in lockstep with the frame, and win it back", () => {
    const heights = reporting()
    // A page drawing equal rows, one a paint — its heights owe the frame
    // nothing, they simply happen to step by as much as the frame last stepped.
    let frame = 630
    const taken = Array.from({ length: 6 }, (_, at) => {
      const said = 400 + at * 137
      const took = heights.says(said, frame)
      if (took) frame = said
      return took
    })
    expect(taken).toEqual([true, true, false, true, true, false])
    // Two of six lost and the frame a row behind the page, rather than the
    // whole of the growth lost after the second report, which is what the
    // count this replaced did.
    expect(frame).toBe(948)
  })

  test("and two frames do not share a record", () => {
    const one = reporting()
    const other = reporting()
    expect(one.says(646, 630)).toBe(true)
    expect(one.says(662, 646)).toBe(false)
    expect(other.says(662, 646)).toBe(true)
  })
})
