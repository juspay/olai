/**
 * The strip in front of a row, and the indents that clear it.
 *
 * A row is a control or two, a gap after each, and then the title: a tree row
 * has a fold toggle and a bullet, a day's row has only the bullet, and under
 * either of them a note has to start where the title starts rather than under
 * the dot. That makes ONE width — the control's — and everything else here
 * arithmetic over it:
 *
 *              control    gap      control    gap
 *   a phone     1.75rem   0.375rem  1.75rem   0.375rem   →  past one: 2.125rem
 *   a pointer   1rem      0.375rem  1rem      0.375rem   →  past two: 4.25rem
 *
 * Which is exactly why it is one module. The width changes with the pointer
 * (a finger needs a bigger control than a mouse, ./Bullet.tsx says why it
 * changes in that axis and not in the other), and when it does, four things
 * have to move together: the control, the blank where a row has no toggle, and
 * the two indents. Spread across the components that draw them, that is a rule
 * held in memory — and it had already been got wrong once, with a day's notes
 * left indented under the bullet on a phone while a tree's were not.
 *
 * The values are literal class names rather than computed ones because
 * Tailwind scans this file as text: a name built at runtime is a name it never
 * emits a rule for. So the arithmetic is written above rather than run, and
 * the four strings below are the one place it lands.
 */

/** A row's control — the bullet, and the fold toggle beside it in a tree.
 *  Centred in a box that is the full 44px tall on a phone and the compact
 *  1rem of a pointer above 48rem. */
export const CONTROL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-auto md:w-4"

/** The same width, holding a place: a row with nothing to fold still lines its
 *  bullet up with the rows that do. */
export const CONTROL_SPACER = "w-7 shrink-0 md:w-4"

/** Past the bullet — where a day's row puts its note. */
export const PAST_BULLET = "ml-[2.125rem] md:ml-5.5"

/** Past the toggle AND the bullet — where a tree's row puts its note, and its
 *  one aside about a mirror it would not expand. */
export const PAST_CONTROLS = "ml-[4.25rem] md:ml-11"
