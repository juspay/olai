/**
 * WHICH OF A PREVIEWED PAGE'S HEIGHT REPORTS THE FRAME ACTS ON, as a rule that
 * can be asked without a browser.
 *
 * A sealed page reports its own height over `postMessage` and `./Hypertext.tsx`
 * sets the frame to what it says. Believing every report is a LADDER: a page
 * sized in `vh` — `min-height: 100vh` on a wrapper is ordinary in a saved
 * dashboard — has a height that IS the frame's height plus whatever else is on
 * the page, so each report is taller because the last one made the frame
 * taller, climbing until the stylesheet's clamp eats it. (Measured, before any
 * guard stood here: a one-screen page came out at 1798px against an 1800px
 * bound.)
 *
 * WHAT USED TO STAND HERE WAS A COUNT — a height taken once per width per kind,
 * two kinds because a page's pictures land after its markup does — and it
 * bounded the ladder at two steps by refusing everything after them. It refused
 * the honest case along with the dishonest one: a chart drawn from a fetch, a
 * `<details>` the reader opens, a `loading="lazy"` picture that does not hold
 * the `load` event. Its own docstring named that as a decision rather than an
 * oversight and argued that "there is no message that tells those apart". There
 * is no such MESSAGE, and the message was the wrong place to look: what tells
 * them apart is the ARITHMETIC between two of them.
 *
 * THE GAP IS THE WHOLE RULE. Every report is a page's height read inside a
 * frame of a known height, and the distance between the two is what the page is
 * over and above the box it is drawn in. A page riding the frame keeps the SAME
 * gap at every height the frame is ever given — grow the box by sixteen pixels
 * and it says sixteen more, because that is what riding means, and the sixteen
 * is its own margins rather than the frame's number handed back. A page that
 * really grew — a picture landed, a script drew, a section opened — stands a
 * DIFFERENT distance above the box, because what moved was the page and not
 * the frame around it.
 *
 * So: act on a report whose gap is not the gap of the report before it, and
 * refuse the one whose gap is unchanged. That one is the frame's own height
 * coming back, and acting on it is climbing.
 *
 * WHAT IT COSTS, because that is a decision too and belongs written down:
 *
 *   - a page that grows by EXACTLY as much as the frame just grew is
 *     indistinguishable from a page that IS the frame — the two send the same
 *     pair of numbers, and no rule reading them can separate them. A page
 *     appending equal rows a frame at a time therefore loses whichever step
 *     lands in lockstep, and wins it back at the next one that does not. What
 *     the count lost was every report after the second, permanently.
 *   - a page that wants MORE than the frame's height — `min-height: 120vh` —
 *     has no height that satisfies it at all: every answer makes it ask for a
 *     bigger one, so its gaps grow rather than repeat and it rides to the
 *     stylesheet's two-screen clamp. That bound is where such a page was always
 *     going to end up; the count merely stopped it two rungs short of it, at a
 *     height no more correct for being smaller.
 *
 * NOTHING IS REMEMBERED BEYOND THE LAST GAP, and that is deliberate. Any rule
 * that remembers the heights it has already answered refuses a reader who opens
 * a `<details>`, closes it and opens it again — an honest page really does come
 * back to a height it had, twice. The only report that can be refused without
 * refusing a reader is the one that says nothing new.
 *
 * AND THEN THERE IS {@link TURNS}, which is not the rule but the BOUND on it,
 * and it is here because the count that left took a promise with it. A page
 * whose height moves the OPPOSITE way from the frame — an element that is
 * taller when its viewport is shorter, which is a thing somebody has to write
 * on purpose, or a page posting two heights in a loop, which is a thing a page
 * running somebody else's JavaScript can simply do — has no height that
 * satisfies it either, and unlike the `120vh` page it does not run out of room:
 * it flips, the frame follows, it flips back, and the gap is different every
 * time so the rule above never refuses it. Under the count that was impossible;
 * under the gap alone it is a frame flickering and a host relaying out for as
 * long as the preview is open.
 *
 * So the frame may REVERSE DIRECTION only so many times without a quiet moment
 * in between. Direction is free — it is the sign of the gap, since a frame
 * about to be set to what the page said moves by exactly that far — and the
 * quiet moment is what keeps this off honest pages: pictures landing all push
 * the same way and turn nothing, and a reader toggling a section turns once and
 * then leaves the page alone for longer than a paint. It is the same bound, in
 * the same spirit, as `./Hypertext.tsx`'s `WALK_OFFS`: a page may do the thing
 * a bounded number of times, and then this app stops answering.
 *
 * A MODULE OF ITS OWN rather than three lines inside the component, and that is
 * the whole reason it exists: this client has no harness that mounts
 * `Hypertext.tsx`, so the rule was reachable only by driving a browser at a page
 * whose picture had to be held back by a route to lose the race on purpose.
 * Held here it is a subtraction and a counter with a unit test beside it
 * (`./echo.test.ts`), the way `../menu/actions.ts` and `../menu/picking.ts` are
 * — and the e2e scenarios go on proving the thing only a browser can, which is
 * that the frame really ends up the height of what is in it.
 */

import { ROUNDING } from "@olai/surface"

/**
 * How many times the frame may be sent the other way, one report after another,
 * before this stops answering.
 *
 * Everything honest turns once or not at all. A page's pictures land, a script
 * draws, a `vh` page climbs its one rung: all of those push the frame the same
 * way every time and turn nothing at all. A page that loads shorter than the
 * `70dvh` guess and then grows turns exactly once. A reader opening and closing
 * a section turns once per press.
 *
 * Six rather than two, and rather than twenty, because the number is read at
 * both ends. It is how long the argument is VISIBLE — a round of it costs a
 * quarter of a second in a browser (measured; the loop is a style write, a
 * layout, an observer callback, a message and a frame callback, not a paint),
 * so six is a second and a half of a frame changing its mind and then stopping.
 * And it is how many presses in a row a reader may make faster than
 * {@link SETTLING} before they have to pause once — which is the cost, stated
 * rather than hidden, and it is a rare shape of reader against a page shape
 * that has to be written on purpose.
 */
const TURNS = 6

/**
 * How long the page has to leave the frame alone before its reversals are
 * forgiven, in milliseconds.
 *
 * A QUIET WINDOW rather than a rate: a page in a loop with the frame is never
 * quiet, so it spends {@link TURNS} and stays spent — and once it is spent the
 * frame stops moving, so the page stops being given anything to answer and the
 * argument is over. A page that changed because a person pressed something is
 * quiet in between, because a person is.
 *
 * A SECOND, and it is measured rather than picked: the loop is not a paint. A
 * round of it — style write, layout, observer callback, message, frame callback
 * — came out at about a quarter of a second in Chromium, so a window of a few
 * frames would forgive every reversal it exists to count and the bound would
 * never engage. A second is comfortably longer than that and comfortably
 * shorter than a reader's second thought.
 */
const SETTLING = 1000

/** One height report, as this rule needs it: what the page said, how tall the
 *  box it said it in is, and when it was heard. */
export interface Report {
  /** How tall the page says it is, as it said it (`@olai/surface`'s `heard`). */
  readonly height: number
  /** How tall the frame it measured itself inside is RIGHT NOW — the box whose
   *  height the page's own `vh` resolves against. */
  readonly frame: number
  /** When, on a monotonic clock. The caller's, because a rule that read a clock
   *  itself would need one wound back to be tested; `./Hypertext.tsx` passes
   *  the timestamp the browser hands its own frame callback, which is the same
   *  clock and costs nothing to read. */
  readonly at: number
}

/** The record of what the last report said, and the two things done to it. */
export interface Echo {
  /**
   * Whether this report is one to act on, and, when it is, the record moves
   * with the answer.
   *
   * Asking and recording are one call on purpose. Split in two they are a rule
   * kept by whoever remembers to write the second line, and the failure mode is
   * the ladder this exists to refuse. EVERY report moves the record, refused
   * ones included — what is kept is the gap of the report before this one, and
   * a report the frame did not act on is still the last thing the page said.
   */
  takes(report: Report): boolean
  /** Nothing has been heard yet. What is here belonged to the document that is
   *  leaving, so this is what a frame being pointed somewhere else says. */
  fresh(): void
}

export const echo = (): Echo => {
  // THE GAP, and it is the DIFFERENCE rather than the two heights it came from.
  // Keeping both would be two things a new document has to clear and a
  // subtraction spelled at the other end; the gap is the whole of what the next
  // report is compared against, so the gap is the whole of what is kept.
  //
  // Nothing at all until a page has spoken once, which is what makes the first
  // reading of every document one to act on: a page is honest until it has said
  // the same thing twice.
  let gap: number | undefined
  // Which way the frame went last, and how many times in a row it has been sent
  // back the other way — {@link TURNS}. `undefined` before there is a direction
  // to reverse.
  let rose: boolean | undefined
  let turns = 0
  // When the page last said anything, refused or not: a page arguing with the
  // frame is a page that never stops talking, and that is what {@link SETTLING}
  // reads.
  let spoke: number | undefined
  return {
    takes({ height, frame, at }) {
      const quiet = spoke === undefined || at - spoke > SETTLING
      spoke = at
      const was = gap
      gap = height - frame
      if (was !== undefined && Math.abs(gap - was) <= ROUNDING) return false
      if (quiet) turns = 0
      const rising = gap > 0
      if (rose !== undefined && rising !== rose) turns += 1
      rose = rising
      return turns <= TURNS
    },
    fresh() {
      gap = undefined
      rose = undefined
      turns = 0
      spoke = undefined
    },
  }
}
