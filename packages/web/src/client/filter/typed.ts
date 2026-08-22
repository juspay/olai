/**
 * WORDS, ONCE A PAIR OF HANDS HAS STOPPED MOVING — and at once for words nobody
 * typed.
 *
 * One rule, and it is the whole of what a debounce over an ADDRESS has to be
 * careful about. A `?q=` reached by a pin, by Back or by a cold load is FINAL
 * the moment it is on screen, so waiting 200ms to ask about it is 200ms of a
 * page drawn whole that the address said was narrowed. A `?q=` that moved with
 * the page standing still is somebody TYPING, and the debounce is the point —
 * a word typed is six questions otherwise.
 *
 * TWO CALLERS is why it is a file. It was written once inside `./asking.ts`,
 * for the narrowing a filter box asks about; the everywhere page
 * (`/search?q=…`) needs the same sentence about the same keystrokes, because
 * its PAGE request carries the words (docs/brainstorming/one-search-box.md).
 * Two copies of a settle are two chances to disagree about which of a
 * navigation and a keystroke is which — and they would disagree on the one page
 * where both readings are about the same box.
 *
 * IT IS NOT `../settled.ts`. That primitive is a QUESTION ASKED — a resource, a
 * failure slot, a latest-answer rule, an answer that carries its question. This
 * is one accessor of text and nothing else: what to do with it is the caller's,
 * and the two callers do quite different things (a stream's input, a page
 * request's field). What they share is `SETTLE_MS`, which is the one fact about
 * one pair of hands and is imported by all three.
 */

import { debounce } from "@solid-primitives/scheduled"
import { type Accessor, createEffect, createSignal } from "solid-js"

import { SETTLE_MS } from "../settled.ts"

/**
 * The words, settled.
 *
 * `null` is "there is nothing to ask", and it is answered AT ONCE rather than
 * after the settle: a page still narrowed by a query the reader has already
 * backspaced away from is a page that is lying for as long as it stands.
 */
export const createTyped = (source: {
  /** What is in the box — `null` for a box that is asking nothing. */
  readonly words: Accessor<string | null>
  /**
   * WHERE THE READER IS, as an identity that moves exactly when they went
   * somewhere else — the pane's own `samePage` memo.
   *
   * It is the whole of the arrival/keystroke distinction: same place, moving
   * words, means a hand; a different place means a link, a pin or Back, and
   * those arrive final.
   */
  readonly arrived: Accessor<unknown>
}): Accessor<string | null> => {
  const [settled, setSettled] = createSignal<string | null>(null)
  const settle = debounce(setSettled, SETTLE_MS)

  createEffect<unknown>((was) => {
    const wanted = source.words()
    const here = source.arrived()
    if (wanted === null) {
      settle.clear()
      setSettled(null)
    } else if (here !== was) {
      settle.clear()
      setSettled(wanted)
    } else {
      settle(wanted)
    }
    return here
  }, undefined)

  return settled
}
