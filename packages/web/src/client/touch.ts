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
 */

/** A control a finger aims at. Paired at each site with what it is above
 *  48rem (`md:min-h-0`, or whatever compact size that control has). */
export const TARGET = "min-h-11"

/** The same, both ways: for a control with no column of its own to fill it
 *  out — a chevron, a lone icon — where the height alone would leave a target
 *  a finger still misses sideways. */
export const TARGET_BOX = "min-h-11 min-w-11"

// ── the gutter, which is where the rule above cannot be obeyed ─────────────
//
// A row is a control or three, a gap after each, and then the title: a tree
// row has a fold toggle, a bullet and a status checkbox; a day's row has the
// bullet and the checkbox; and under either of them a note has to start where
// the title starts rather than under the last control.
//
// Those gutter controls are the exception to `TARGET`, and a deliberate one: a
// 44px-WIDE toggle and a 44px-wide bullet at every level of indent leave a
// 390px screen no room for the title they are in front of. So they take the
// full 44px in height — the axis where a miss lands on the wrong node — and
// the 1.75rem across that the racket original used for the same control on the
// same screen.
//
// Which is why they and their indents live together here. One width, and
// everything else arithmetic over it:
//
//              control    gap      control    gap      control    gap
//   a phone     1.75rem   0.375rem  1.75rem   0.375rem  1.75rem   0.375rem
//   a pointer   1rem      0.375rem  1rem      0.375rem  1rem      0.375rem
//
//   past two (day: bullet + checkbox) → phone 4.25rem, pointer 2.75rem
//   past three (tree: toggle + bullet + checkbox) → phone 6.375rem, pointer 4.125rem
//
// When the width moves, five things move with it: the control, the blank where
// a row has no toggle, and the two indents. Spread across the components that
// draw them, that is a rule held in memory — and it had already been got wrong
// once, with a day's notes left indented under the bullet on a phone while a
// tree's were not.
//
// The values are literal class names rather than computed ones because
// Tailwind scans this file as text: a name built at runtime is a name it never
// emits a rule for. So the arithmetic is written above rather than run, and
// the four strings below are the one place it lands.

/** A row's control — the bullet, the fold toggle beside it in a tree, and the
 *  status checkbox beside the bullet. */
export const CONTROL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-auto md:w-4"

/** The same width, holding a place: a row with nothing to fold still lines its
 *  bullet up with the rows that do, and a row with no MARK still lines its
 *  title up with the rows that carry one. */
export const CONTROL_SPACER = "w-7 shrink-0 md:w-4"

/** Past the bullet AND the checkbox — where a day's row puts its note. */
export const PAST_BULLET = "ml-[4.25rem] md:ml-11"

/** Past the toggle, the bullet AND the checkbox — where a tree's row puts its
 *  note, and its one aside about a mirror it would not expand. */
export const PAST_CONTROLS = "ml-[6.375rem] md:ml-[4.125rem]"
