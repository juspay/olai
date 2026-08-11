/**
 * How big a thing a finger aims at has to be, and the one place that is not
 * free.
 *
 * 2.75rem — 44px, the number both mobile platforms print in their guidelines —
 * and only below 48rem, because it is a fact about the POINTER: on a laptop
 * the same rule would space a sidebar out for nothing. 48rem rather than
 * `pointer: coarse` so that this and the layout are one line and not two: the
 * sidebar stops being a column at exactly that width (../client/App.tsx), the
 * racket original drew both from the same `phone-max`, and a control that grew
 * on a touchscreen laptop while the layout stayed in two columns would be a
 * third case nobody has looked at.
 *
 * What a control is ABOVE that line is per control — a day of the month goes
 * back to a 1.75rem row, a pill to its padding, a bullet to 1rem — so the
 * reset is spelled at each site and only the target is spelled here. That is
 * the whole split: one number that is a policy, and per-control compactness
 * that is a design.
 *
 * ## The gutter (Workflowy arithmetic)
 *
 * A tree row's left side is four places, left to right:
 *
 *   hover gutter (menu + triangle) · bullet · checkbox · title
 *
 * On a pointer device the menu and triangle appear only on row hover / focus;
 * on a phone they stay visible (there is no hover). The permanent widths are
 * still reserved so a title never shifts under the pointer when the controls
 * fade in.
 *
 * Literal class names rather than computed ones: Tailwind scans this file as
 * text, and a name built at runtime is a name it never emits a rule for.
 */

/** A control a finger aims at. Paired at each site with what it is above
 *  48rem (`md:min-h-0`, or whatever compact size that control has). */
export const TARGET = "min-h-11"

/** The same, both ways: for a control with no column of its own to fill it
 *  out — a chevron, a lone icon — where the height alone would leave a target
 *  a finger still misses sideways. */
export const TARGET_BOX = "min-h-11 min-w-11"

// ── the gutter ─────────────────────────────────────────────────────────────
//
//              hover     gap   bullet   gap   checkbox  gap
//   a phone     3.5rem   0     1.75rem  0.25  1.75rem   0.375
//   a pointer   2.25rem  0     1rem     0.25  1rem      0.375
//
//   past two (day: bullet + checkbox) → phone 4rem, pointer 2.625rem
//   past three (tree: hover + bullet + checkbox) → phone 7.5rem, pointer 4.875rem
//
// When a width moves, five things move with it: each control, the blank that
// holds a missing one, and the two indents. They live together here.

/** A row's permanent control — the bullet and the status checkbox. */
export const CONTROL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

/** The same width, holding a place: a row with no MARK still lines its title
 *  up with the rows that carry one. */
export const CONTROL_SPACER = "w-7 shrink-0 md:w-4"

/**
 * The hover gutter: `•••` menu and the collapse triangle.
 *
 * Two control-widths on a phone (always visible); on a pointer device a
 * tighter strip that the controls fade into on row hover. The triangle lives
 * here so a Workflowy reader finds it left of the bullet, not where a legacy
 * outliner put a always-on chevron.
 */
export const HOVER_GUTTER =
  "inline-flex h-11 w-14 shrink-0 items-center justify-end gap-0.5 md:h-5 md:w-9"

/** One cell inside the hover gutter (menu trigger or triangle). */
export const HOVER_CELL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

/**
 * Reveal policy for hover-only gutter controls.
 *
 * Below 48rem: always on (a finger has no hover). Above: invisible until the
 * row is hovered or something in the gutter is focused — keyboard users tab
 * into the triangle and the menu the same way.
 *
 * Applied on the row (`group/row`) and read here so every control that hides
 * shares one answer.
 */
export const HOVER_REVEAL =
  "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"

/** Past the bullet AND the checkbox — where a day's row puts its note. */
export const PAST_BULLET = "ml-16 md:ml-[2.625rem]"

/** Past the hover gutter, the bullet AND the checkbox — where a tree's row
 *  puts its note, and its one aside about a mirror it would not expand. */
export const PAST_CONTROLS = "ml-[7.5rem] md:ml-[4.875rem]"

/** How far a child list indents from its parent, and the vertical guide. */
export const CHILD_INDENT = "ml-3 list-none border-l border-rule pl-3 md:ml-4 md:pl-4"
