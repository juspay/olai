/**
 * Where the line runs, and everything measured from it.
 *
 * The agenda's own gutter arithmetic, in the shape this codebase already has
 * for gutter arithmetic (`../touch.ts`, whose header does the same job for a
 * tree row): the numbers that must agree, declared together, with the table
 * that says why — because a dot and the line it sits on drifting apart is
 * exactly the bug three separate literals produce.
 *
 * A rung's left side, left to right:
 *
 *   gutter (2.5rem) · the row's own content
 *
 * and inside the gutter, everything centred on its middle:
 *
 *   the LINE      2px wide, from 1.25rem − 1px          → centre 1.25rem
 *   a DAY DOT     7px, centred in a 2.5rem cell         → centre 1.25rem
 *   the NOW DOT   11px, same cell                       → centre 1.25rem
 *
 * ONE CELL for both dots, so the three sizes cannot come to disagree about
 * where the middle is: move the gutter and the line, the dots and the indent
 * move with it. Literal class names, never computed ones — Tailwind scans this
 * file as text.
 *
 * WHAT IS NOT HERE is the ink (./spine.ts): a tone is a palette token and a
 * width is a decision about a hand and a screen, and they change for different
 * reasons. This file names no colour at all.
 */

/** The gutter the line runs in — what everything to the right of it is
 *  indented by. */
export const SPINE_INDENT = "pl-10"

/** One cell of that gutter, holding a dot centred on the line. */
export const SPINE_CELL = "flex w-10 shrink-0 items-center justify-center"

/** The line through one rung. `top-0 bottom-0` over a rung that is `relative`,
 *  so a stretch is exactly as tall as the day it belongs to. */
export const SPINE_LINE = "absolute left-[calc(1.25rem-1px)] top-0 bottom-0 w-0.5"

/** A listed day, on the line. */
export const SPINE_DOT = "size-[7px] shrink-0 rounded-full"

/** NOW, on the line: bigger, so it reads as a place rather than as a louder
 *  dot. What makes it a place is the ring, which is ink and is ./spine.ts's. */
export const SPINE_NOW = "size-[11px] shrink-0 rounded-full"
