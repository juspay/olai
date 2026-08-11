/**
 * Where a hover tip goes, which is the only hard part of drawing one.
 *
 * The browser's own `title` tooltip was what this replaces: it cannot be read
 * by a keyboard, it cannot be styled to look like the page, and — the reason
 * it had to go — it is placed by the platform, which let a long one run off
 * the right edge of the window with the end of the sentence outside the
 * screen. A tip nobody can finish reading is a tip that did not say anything.
 *
 * So the tip is ours, and this is the arithmetic that keeps it on screen,
 * pulled out as a function because it is the part worth testing: everything
 * else about a tip is a `position: fixed` div and two event handlers.
 */

/** How close to the window's edge a tip may come. */
const MARGIN = 8

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
