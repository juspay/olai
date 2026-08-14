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
 * A tree row's left side, left to right:
 *
 *   hover strip (triangle; + `•••` on pointer devices) · bullet · checkbox · title
 *
 * On a pointer device the menu and triangle appear only on row hover / focus;
 * on a phone the triangle stays visible (there is no hover) and the `•••` is
 * hidden — a phone has no room for two always-on cells before the title
 * (see packages/web/README.md). The permanent widths are still reserved so a
 * title never shifts under the pointer when the controls fade in.
 *
 * EVERY gap in the row is `GUTTER_GAP`. The note indents (`PAST_*`) are the
 * arithmetic of those widths + gaps; change a control width or the gap and
 * both the table and the constants below must move together. Literal class
 * names rather than computed ones: Tailwind scans this file as text.
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
//   GUTTER_GAP = 0.25rem (gap-1) between every flex sibling on the row.
//
//   CONTROL / HOVER_CELL: phone 1.75rem (w-7), pointer 1rem (w-4)
//
//   Tree hover strip:
//     phone  — triangle only                         → 1.75rem
//     pointer — menu + gap + triangle                → 1 + 0.25 + 1 = 2.25rem
//
//   Tree PAST_CONTROLS (hover + 3×gap + bullet + checkbox):
//     phone   1.75 + 0.75 + 1.75 + 1.75 = 6rem
//     pointer 2.25 + 0.75 + 1    + 1    = 5rem
//
//   Day PAST_BULLET (bullet + 2×gap + checkbox):
//     phone   1.75 + 0.5 + 1.75 = 4rem
//     pointer 1    + 0.5 + 1    = 2.5rem
//
// When a width moves, the control, the spacer, HOVER_*, and the two PAST_*
// constants move with it. They live together here.

/** Gap between gutter siblings — tree row, day row, and inside the hover
 *  strip. One export so the JSX and the PAST arithmetic cannot disagree. */
export const GUTTER_GAP = "gap-1"

/** A row's permanent control — the bullet and the status checkbox. */
export const CONTROL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

/** The same width, holding a place: a row with no MARK still lines its title
 *  up with the rows that carry one. */
export const CONTROL_SPACER = "w-7 shrink-0 md:w-4"

/**
 * The hover strip: collapse triangle always; `•••` menu on pointer devices
 * only (the menu is `hidden md:…` at its site). Width matches content so a
 * fixed `w-*` cannot drift from the cells it holds.
 */
export const HOVER_GUTTER =
  `inline-flex h-11 shrink-0 items-center justify-end ${GUTTER_GAP} md:h-5`

/** One cell inside the hover strip (menu trigger or triangle). */
export const HOVER_CELL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

/**
 * Reveal policy for hover-only gutter controls (triangle; menu on md+).
 *
 * Below 48rem: always on (a finger has no hover). Above: invisible until the
 * row line is hovered or something in the gutter is focused.
 */
export const HOVER_REVEAL =
  "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"

/**
 * Reveal for the `•••` menu button — only reached when its parent is shown
 * (the menu root is `hidden md:block`). Hover/focus-only; no phone branch.
 *
 * `data-[expanded]` is the third arm and it is not optional: an OPEN menu
 * whose `•••` had faded out would be a panel hanging off nothing. Kobalte puts
 * that attribute on the trigger for exactly this (`menu/NodeMenu.tsx`), which
 * is steadier than the focus it used to ride on — a menu's own list can take
 * and drop the caret as a pointer moves over it.
 */
export const MENU_REVEAL =
  "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 " +
  "data-[expanded]:opacity-100"

/** Past the bullet AND the checkbox — where a day's row puts its note. */
export const PAST_BULLET = "ml-16 md:ml-10"

/** Past the hover strip, the bullet AND the checkbox — where a tree's row
 *  puts its note, and its one aside about a mirror it would not expand. */
export const PAST_CONTROLS = "ml-24 md:ml-20"

/**
 * A row's TITLE, as type: the size and leading a line of the outline is set
 * in. Here because the input that replaces a title while it is being typed
 * must be the same box (`../client/edit/RowEditor.tsx`) — a row that shifted
 * by a pixel when the caret arrived would be this file's kind of bug, and
 * three literals were three chances for one of them to miss a change.
 */
export const ROW_TITLE = "font-serif text-[0.9375rem] leading-snug"

/**
 * A row's NOTE, as type: what the clamped line, the rendered note and the
 * editor that replaces them all have to agree about, for the same reason the
 * title's scale is here — the note edits in place, and a note that changed
 * size or colour when the caret arrived would be a different thing appearing
 * rather than the same thing becoming editable.
 */
export const ROW_NOTE = "text-[0.875rem] leading-snug text-muted"

/** How far a child list indents from its parent, and the vertical guide. */
export const CHILD_INDENT = "ml-3 list-none border-l border-rule pl-3 md:ml-4 md:pl-4"
