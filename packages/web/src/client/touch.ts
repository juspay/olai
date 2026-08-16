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
 *   hover strip (triangle; + `•••` on pointer devices) · glyph · title
 *
 * ONE GLYPH CELL, not two. The bullet and the status box were separate columns
 * until the quiet outline merged them (`../client/Glyph.tsx`): one cell says
 * what the node is AND is the way into it, which gave a phone back 2rem of a
 * 390pt screen and gave every reader one place to look instead of two.
 *
 * On a pointer device the menu and triangle appear only on row hover / focus;
 * on a phone the triangle stays visible (there is no hover) and the `•••` is
 * not drawn at all — a phone has no room for two always-on cells before the
 * title (see packages/web/README.md). What a phone reaches the MENU with
 * instead is a long press on the row, which costs no width at all
 * (../client/longPress.ts); the menu's root is still in the markup below 48rem
 * to hold the panel that opens, and is taken out of the strip's flow
 * (`absolute`) so the arithmetic below stays true — a strip with no `•••` in
 * it is exactly as wide as its triangle. The permanent widths are still
 * reserved so a title never shifts under the pointer when the controls fade
 * in.
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
//   Tree PAST_CONTROLS (hover + 2×gap + glyph):
//     phone   1.75 + 0.5 + 1.75 = 4rem
//     pointer 2.25 + 0.5 + 1    = 3.75rem
//
//   Day PAST_BULLET (glyph + gap):
//     phone   1.75 + 0.25 = 2rem
//     pointer 1    + 0.25 = 1.25rem
//
// When a width moves, the control, the spacer, HOVER_*, and the two PAST_*
// constants move with it. They live together here.

/** Gap between gutter siblings — tree row, day row, and inside the hover
 *  strip. One export so the JSX and the PAST arithmetic cannot disagree. */
export const GUTTER_GAP = "gap-1"

/**
 * A row's permanent control — the glyph, and the hollow dot a row that does not
 * exist yet draws in its place.
 *
 * There used to be a second one beside it and a blank of the same width for the
 * rows that carried no mark; the glyph column absorbed both
 * (`../client/Glyph.tsx`), so every row now spends exactly one of these and
 * nothing has to hold a place open.
 */
export const CONTROL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

/**
 * The hover strip: collapse triangle always; `•••` menu on pointer devices
 * only (below md the menu's root is out of this flow at its own site, so it
 * takes neither a cell nor a gap). Width matches content so a fixed `w-*`
 * cannot drift from the cells it holds.
 */
export const HOVER_GUTTER =
  `inline-flex h-11 shrink-0 items-center justify-end ${GUTTER_GAP} md:h-5`

/** One cell inside the hover strip (the triangle, and the `•••` above md). */
export const HOVER_CELL =
  "inline-flex h-11 w-7 shrink-0 items-center justify-center md:h-5 md:w-4"

/**
 * The `•••` cell: the same box, drawn only where there is room for it.
 *
 * Its own constant rather than `${HOVER_CELL} hidden md:inline-flex`, because
 * that reads as a rule and is not one: `hidden` and `inline-flex` are the same
 * property, so which of them wins below md is Tailwind's emission order and not
 * the order they are written in. Spelled here, the display is stated once per
 * breakpoint and cannot be undone by the cell it is built from.
 */
export const MENU_CELL =
  "hidden h-11 w-7 shrink-0 items-center justify-center md:inline-flex md:h-5 md:w-4"

/**
 * A surface a finger may be HELD on (`../client/longPress.ts`).
 *
 * iOS raises its own callout for a long press and does not send the
 * `contextmenu` that would let it be prevented, so it is turned off wherever
 * this client claims the gesture. (Android's arrives as that event and is
 * answered there instead — one platform each, and the halves are named where
 * they are done.)
 */
export const HELD = "[-webkit-touch-callout:none]"

/**
 * Reveal policy for hover-only gutter controls (triangle; menu on md+).
 *
 * Below 48rem: always on (a finger has no hover). Above: invisible until the
 * row line is hovered or something in the gutter is focused.
 */
export const HOVER_REVEAL =
  "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"

/**
 * Reveal for the `•••` menu button — hover/focus-only, and no phone branch,
 * because the button it is on is not drawn below md at all ({@link MENU_CELL}).
 * An opacity there would be an opacity on a `display: none` box.
 *
 * `data-[expanded]` is the third arm and it is not optional: an OPEN menu
 * whose `•••` had faded out would be a panel hanging off nothing. Kobalte puts
 * that attribute on the trigger for exactly this (`menu/Dropdown.tsx`), which
 * is steadier than the focus it used to ride on — a menu's own list can take
 * and drop the caret as a pointer moves over it.
 */
export const MENU_REVEAL =
  "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 " +
  "data-[expanded]:opacity-100"

/** Past the glyph — where a day's row puts its note. */
export const PAST_BULLET = "ml-8 md:ml-5"

/** Past the hover strip AND the glyph — where a tree's row puts its note, and
 *  its one aside about a mirror it would not expand. */
export const PAST_CONTROLS = "ml-16 md:ml-15"

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

/**
 * THERE IS NO MEASURE, and its absence is a ruling rather than an omission.
 *
 * The quiet outline's brief asked for two: the tree capped near 80 characters
 * and an opened note wrapped near 62. Both were built, and the human rejected
 * both on sight of the first build ("why not full width? why waste space on
 * right"; "no need to wrap desc either. just take full width"). The reason they
 * were wrong here is worth keeping, because the typographic argument for a
 * measure is real and will be made again:
 *
 *   - a ROW is a LINE, not a paragraph. Nobody tracks back to the start of the
 *     next one, so the cap bought no legibility — and it cost text, because a
 *     title longer than it ellipsizes and there was empty pane beside the
 *     ellipsis. Text lost with room to spare is the trade a measure must never
 *     make.
 *   - a NOTE under a row is read in the tree it hangs in, at a glance, against
 *     the rows above and below it. Ragged short lines with a hand's width of
 *     empty pane to their right read as a column that has stopped rather than as
 *     a page that is set.
 *
 * What survives of that move is the ellipsis: a long title is still ONE line
 * (`../client/NodeLine.tsx`), it just gets the whole pane before it is cut.
 */

/** How far a child list indents from its parent, and the vertical guide. */
export const CHILD_INDENT = "ml-3 list-none border-l border-rule pl-3 md:ml-4 md:pl-4"

/**
 * The outline's own left RAIL: the strip a press can land on beside a row that
 * has no list above it to indent from.
 *
 * A nested list gives its branch one for free — the padding half of
 * {@link CHILD_INDENT} is scaffolding a person can press, which is what makes a
 * drag-across startable beside any indented row (`../client/drag/sweeping.ts`).
 * A ROOT row had none: the outline's own list is flush, so the leftmost
 * empty-looking band on a flat inbox belonged to the row's hover controls, and
 * the one sweep such a page could not make was a prefix of it.
 *
 * Taken out of the PANE's padding rather than out of the page — the negative
 * margin and the padding are the same number — so the rail exists at depth 0
 * and nothing moves by a pixel. The numbers are the nested list's own, because
 * it is the same strip one level up.
 */
export const ROOT_RAIL = "-ml-3 pl-3 md:-ml-4 md:pl-4"
