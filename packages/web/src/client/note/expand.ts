/**
 * In-place note expansion for a row.
 *
 * There is one shape of note under a tree or day row: a gray ellipsized
 * snippet on the title line, and the full note (with date and see) when the
 * row is open. Open comes from two inputs that must not fight:
 *
 *   - HOVER on a fine pointer expands while the pointer is over the row and
 *     collapses on mouse-out (Things-style).
 *   - TAP on the snippet toggles the same expansion for touch, where there is
 *     no hover. A second tap folds it.
 *
 * Both are component-local — not a reading cell, not keyed by place in
 * view.ts. The density switch and the per-place unfold set are gone; this is
 * the only open state left, and it dies with the row that holds it.
 */

import { createMemo, createSignal, type Accessor } from "solid-js"

/** Whether this environment treats hover as the primary expand gesture. */
export const finePointerHover = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
}

export interface NoteExpand {
  /** The row is drawn open — hover and/or a sticky touch toggle. */
  readonly expanded: Accessor<boolean>
  /** Wire on the row's outer element: enter sets hover open. */
  readonly onMouseEnter: () => void
  /** Wire on the row's outer element: leave clears hover, and on a fine
   *  pointer also clears a sticky open so mouse-out fully collapses. */
  readonly onMouseLeave: () => void
  /** Toggle the sticky open (the snippet's tap / click). */
  readonly toggle: () => void
}

export const createNoteExpand = (): NoteExpand => {
  const [open, setOpen] = createSignal(false)
  const [hovered, setHovered] = createSignal(false)
  const expanded = createMemo(() => open() || hovered())

  return {
    expanded,
    // Only a fine pointer's hover expands. Touch and coarse pointers often
    // synthesise mouseenter after a tap (Playwright's click path does the same
    // after opening an outline), and treating that as "hover open" would hide
    // the snippet the next tap is meant to find.
    onMouseEnter: () => {
      if (finePointerHover()) setHovered(true)
    },
    onMouseLeave: () => {
      setHovered(false)
      // Sticky open is for touch. On a mouse, mouse-out must fully collapse —
      // leaving open true would strand the row open after the pointer left.
      if (finePointerHover()) setOpen(false)
    },
    toggle: () => setOpen((current) => !current),
  }
}
