/**
 * The two things about a hover tip that are not "a div and two handlers":
 * where it goes, and the fact that there is only ever one.
 *
 * The browser's own `title` tooltip was what this replaces: it cannot be read
 * by a keyboard, it cannot be styled to look like the page, and — the reason
 * it had to go — it is placed by the platform, which let a long one run off
 * the right edge of the window with the end of the sentence outside the
 * screen. A tip nobody can finish reading is a tip that did not say anything.
 *
 * Both halves live here rather than in the component because both are worth
 * testing on their own: the arithmetic is a function of three numbers, and
 * "only one tip is open" is an invariant ACROSS components, which no single
 * component can keep.
 */

import { createSignal } from "solid-js"

/** How close to the window's edge a tip may come. */
const MARGIN = 8

/** How far below the anchor — or the header, if the anchor sits inside it —
 *  a tip starts. */
const TIP_GAP = 4

/**
 * The left edge to draw a tip at: under its anchor, pulled back when that
 * would push its right edge past the window, and never past the left edge —
 * a tip wider than the window has nowhere to go, and hanging off the LEFT is
 * strictly worse, because that is the end you start reading at.
 *
 * Widths are the caller's, measured after the tip has drawn: a tip wraps, so
 * what it is wide is a fact about the text, the font and the window, and not
 * one this can be told in advance.
 */
export const clampedLeft = (
  anchorLeft: number,
  tipWidth: number,
  viewportWidth: number,
): number => Math.max(MARGIN, Math.min(anchorLeft, viewportWidth - tipWidth - MARGIN))

/**
 * The top edge to draw a tip at: under its anchor, but never under the
 * header.
 *
 * A header pill's box ends INSIDE the bar. Starting {@link TIP_GAP} below
 * THAT is how the coral rule used to cut the first line of the sentence —
 * the bar is a stacking context above the page layer, so the tip was
 * painted through rather than merely overlapping. The floor is the bar's
 * bottom edge when there is one, and the anchor's own bottom when there
 * is not (a row's tip, already below the chrome).
 */
export const clampedTop = (anchorBottom: number, floor: number): number =>
  Math.max(anchorBottom, floor) + TIP_GAP

// ── one tip, ever ──────────────────────────────────────────────────────

/**
 * WHICH tip is open, for the whole document — one signal, because "at most one
 * tip is on screen" is a fact about the page and not about any tip in it.
 *
 * Each tip closing itself on its own `mouseleave` is not enough, and the bug
 * that says so was on screen: a pointer resting on a mark while the tree
 * re-rendered under it — a fold, a preference pick, a frame from the live store —
 * leaves the mark somewhere else with the pointer over nothing, and a browser
 * fires no `mouseleave` for an element that moved out from under a STATIONARY
 * pointer. That tip was then open for good: the only event that would have
 * closed it was one that could no longer happen. Hover the next mark and there
 * were two, saying the same sentence a few pixels apart, both unreadable —
 * which is exactly what four items waiting on one blocker looked like.
 *
 * So opening one closes every other by construction: they all read this, and
 * the one whose token is not in it draws nothing.
 */
export type Tipped = { readonly opened: unique symbol }

const [open, setOpen] = createSignal<Tipped | undefined>()

/** A tip's identity. Object identity IS the token: nothing about a tip
 *  distinguishes it from another with the same text, and nothing needs to. */
export const takeTip = (): Tipped => ({}) as Tipped

export const showTip = (tip: Tipped): void => {
  // The VALUE form, not the updater one: for a signal whose type includes
  // `undefined`, Solid's setter reads a function argument as the no-argument
  // overload, and the tip would be set to nothing at all.
  setOpen(tip)
}

/** Close it, if it is still the one open — a tip that was superseded while it
 *  was closing must not close its successor. */
export const hideTip = (tip: Tipped): void => {
  if (open() === tip) setOpen(undefined)
}

export const tipShowing = (tip: Tipped): boolean => open() === tip
