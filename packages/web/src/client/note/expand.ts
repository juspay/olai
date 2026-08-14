/**
 * In-place note expansion for a row (Workflowy-style).
 *
 * There is one shape of note under a tree or day row: a gray one-line clamp
 * under the title, and the full multi-line note (with date and see) when open.
 * Open is a click on the note itself — click again, or click away, collapses.
 * No hover. Touch is the same click.
 *
 * Component-local — not a preference, not a stamped reading. The
 * density switch and the per-place unfold set are gone; this is the only open
 * state left, and it dies with the row that holds it.
 *
 * How it SHUTS is `../dismiss.ts`, which is the client's one spelling of the
 * two gestures — so this panel gained Escape by being deduped rather than by
 * being argued about. That is the model this note already documents anyway:
 * expanding and editing are one state and you leave both at once
 * (`features/keyboard_editing.feature`), and Escape has always been how a
 * caret leaves.
 */

import { createSignal, type Accessor } from "solid-js"

import { dismissOn } from "../dismiss.ts"

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

  // ONE root: the note is laid out inside the control that opens it, so there
  // is no portalled trigger to consult as well.
  dismissOn({
    open,
    panel: () => root,
    dismiss: () => setOpen(false),
  })

  return {
    expanded: open,
    toggle: () => setOpen((current) => !current),
    setRoot: (el) => {
      root = el
    },
  }
}
