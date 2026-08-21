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
 * A MODULE OF ITS OWN rather than three lines inside the component, and that is
 * the whole reason it exists: this client has no harness that mounts
 * `Hypertext.tsx`, so the rule was reachable only by driving a browser at a page
 * whose picture had to be held back by a route to lose the race on purpose.
 * Held here it is one subtraction with a unit test beside it (`./echo.test.ts`),
 * the way `../menu/actions.ts` and `../menu/picking.ts` are — and the e2e
 * scenarios go on proving the thing only a browser can, which is that the frame
 * really ends up the height of what is in it.
 */

/**
 * How far two readings of one gap may disagree and still be the same gap.
 *
 * The tape measure rounds a fractional layout UP to the whole pixel
 * (`@olai/surface`'s `heard`) and the frame's own height is rounded at this
 * end, so two integers describing one unchanged distance may differ by one
 * either way. Compared exactly, the ladder would go unrefused every time a
 * sub-pixel moved. The same two pixels `packages/tests`' height steps allow,
 * and for the same reason.
 */
const ROUNDING = 2

/** The record of what the last report said, and the two things done to it. */
export interface Echo {
  /**
   * Whether this report — a page of `height` measured inside a frame currently
   * `frame` tall — is one to act on, and, when it is, the record moves with the
   * answer.
   *
   * Asking and recording are one call on purpose. Split in two they are a rule
   * kept by whoever remembers to write the second line, and the failure mode is
   * the ladder this exists to refuse.
   */
  takes(height: number, frame: number): boolean
  /** Nothing has been heard yet. The gap belonged to the document that is
   *  leaving, so this is what a frame being pointed somewhere else says. */
  fresh(): void
}

export const echo = (): Echo => {
  // ONE NUMBER, and it is the DIFFERENCE rather than the two heights it came
  // from. Keeping both would be two things a new document has to clear and a
  // subtraction spelled at the other end; the gap is the whole of what the next
  // report is compared against, so the gap is the whole of what is kept.
  //
  // Nothing at all until a page has spoken once, which is what makes the first
  // reading of every document one to act on: a page is honest until it has said
  // the same thing twice.
  let gap: number | undefined
  return {
    takes(height, frame) {
      const was = gap
      gap = height - frame
      return was === undefined || Math.abs(gap - was) > ROUNDING
    },
    fresh() {
      gap = undefined
    },
  }
}
