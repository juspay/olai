/**
 * In-place note expansion for a row (Workflowy-style).
 *
 * There is one shape of note under a tree or day row: a gray one-line clamp
 * under the title, and the full multi-line note (with date and see) when open.
 * Open is a click on the note itself — click again, or click away, collapses.
 * No hover. Touch is the same click.
 *
 * Component-local — not a reading cell, not keyed by place in view.ts. The
 * density switch and the per-place unfold set are gone; this is the only open
 * state left, and it dies with the row that holds it.
 */

import {
  createEffect,
  createSignal,
  onCleanup,
  type Accessor,
} from "solid-js"

export interface NoteExpand {
  readonly expanded: Accessor<boolean>
  /** Toggle open/closed (the note's click / tap). */
  readonly toggle: () => void
  /** Wire as `ref` on the note control root so "click away" can find it. */
  readonly setRoot: (el: HTMLElement | undefined) => void
}

export const createNoteExpand = (): NoteExpand => {
  const [open, setOpen] = createSignal(false)
  let root: HTMLElement | undefined

  // While open, a pointerdown outside the note control collapses it. Capture
  // phase so a click that starts a navigation still closes the note first, and
  // so the note's own click can toggle without racing a bubble-phase listener.
  createEffect(() => {
    if (!open()) return
    const onDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (root !== undefined && root.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onDown, true)
    onCleanup(() => document.removeEventListener("pointerdown", onDown, true))
  })

  return {
    expanded: open,
    toggle: () => setOpen((current) => !current),
    setRoot: (el) => {
      root = el
    },
  }
}
