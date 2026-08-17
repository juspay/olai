/**
 * THE TWO RUNGS a preview's frame may climb, as a rule that can be asked
 * without a browser.
 *
 * A sealed page reports its own height over `postMessage` and `./Hypertext.tsx`
 * sets the frame to what it says. Believing every report is a LADDER: a page
 * sized in `vh` — `min-height: 100vh` on a wrapper is ordinary in a saved
 * dashboard — has a height that IS the frame's height, so each report is taller
 * because the last one made the frame taller, climbing until the clamp eats it.
 * (Measured, before this guard existed: a one-screen `100vh` page came out at
 * 1798px against a 1800px bound.)
 *
 * So a height is taken ONCE PER WIDTH, PER KIND, and there are two kinds
 * because there are two moments a page's height is honestly different:
 *
 *   - a reflow at a NEW WIDTH, which is a real answer to a new question;
 *   - a page whose PICTURES HAVE ARRIVED. An `<img>` is a zero-tall box until
 *     its bytes land, so the reading taken when the document parsed is short by
 *     however tall the pictures turn out to be, and the frame's own `load` is
 *     when there is nothing left to wait for. `@olai/surface`'s `seal.ts` tags
 *     that reading and argues why the tag has to come from inside the frame
 *     rather than be guessed out here.
 *
 * Two rungs, then, and not an open ladder: at one width this takes at most one
 * arriving reading and at most one settled one. A page that DRAWS ITSELF with
 * its own script needs nothing further — whatever it draws is drawn before its
 * `load`, and the `ResizeObserver` in the measure reports the box it drew, so
 * it is the arriving rung doing its job. What the two rungs COST is worth
 * writing down, because it is a decision and not an oversight — a picture that
 * arrives after `load` (a `loading="lazy"` one, say) grows the page and is
 * refused a rung, so the frame keeps the height it had and the rest of the page
 * scrolls inside it, bounded by the stylesheet. A frame that followed such a
 * picture would be a frame that follows a `vh` page too, and there is no
 * message that tells those apart.
 *
 * A MODULE OF ITS OWN rather than three lines inside the component, and that is
 * the whole reason it exists: this client has no harness that mounts
 * `Hypertext.tsx`, so the rule was reachable only by driving a browser at a
 * page whose picture had to be held back by a route to lose the race on
 * purpose. Held here it is a state machine with a unit test beside it
 * (`./rungs.test.ts`), the way `../menu/actions.ts` and `../menu/picking.ts`
 * are — and the e2e scenarios go on proving the thing only a browser can, which
 * is that the frame really ends up the height of what is in it.
 */

import type { Reading } from "@olai/surface"

/** The record of what has been taken, and the two things done to it. */
export interface Rungs {
  /**
   * Whether a reading of this KIND at this WIDTH is one to act on — and, when
   * it is, the record moves with the answer.
   *
   * Asking and recording are one call on purpose. Split in two they are a rule
   * kept by whoever remembers to write the second line, and the failure mode is
   * the ladder this exists to refuse.
   *
   * The record holds the LAST width each kind was taken at, not every width it
   * has ever seen — so a window dragged back to a size it had before opens both
   * rungs again. That is right rather than leaky: the ladder is a page
   * reporting a new height at an UNCHANGED width, and a window that really went
   * 800 → 640 → 800 really did reflow twice. A set would read as the more
   * careful choice and would leave the second reflow unanswered.
   */
  takes(reading: Reading, width: number): boolean
  /** Nothing has been taken yet. The heights belonged to the document that is
   *  leaving, so this is what a frame being pointed somewhere else says. */
  fresh(): void
}

export const rungs = (): Rungs => {
  // ONE RECORD, filed under the reading the frame named, rather than a variable
  // per kind. Two variables would be two things a new document has to remember
  // to clear, and the rule that they clear together would live in whoever
  // remembered to write both lines; here the whole record is replaced and the
  // rule is the assignment.
  let takenAt: Partial<Record<Reading, number>> = {}
  return {
    takes(reading, width) {
      if (takenAt[reading] === width) return false
      takenAt[reading] = width
      return true
    },
    fresh() {
      takenAt = {}
    },
  }
}
