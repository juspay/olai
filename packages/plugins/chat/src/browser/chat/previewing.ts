/** Per-conversation previewing state, created by the conversation UI owner.
 * It survives folding within this tab activation and leaves with that owner. */

import { createSignal } from "solid-js"

export const createPreviewing = () => {
const [open, setOpen] = createSignal<string | null>(null)

/** The `Agent` frame whose calls are being read, or `null` — which is nearly
 *  every moment of nearly every conversation. */
const previewing = open

/** Whether THIS frame is the open one. Spelled here rather than compared at
 *  each door, so that "open" is one question with one answer. */
const isPreviewing = (row: string): boolean => open() === row

/** Open this agent's work — or close it, when it is the one already open. The
 *  door is the same control both ways round, because a reader who presses the
 *  agent they are already reading means *put it away*. */
const togglePreview = (row: string): void => {
  setOpen((was) => (was === row ? null : row))
}

/** ... and close whatever is open, from the two places that are not a door.
 *
 *  The shelf's own × was one of them and is gone (the human, 2026-08-28): a
 *  control on a box about an agent reads as a control over the AGENT, and one
 *  reader read it exactly that way. What is left are the two closings that are
 *  not a reader putting a shelf away at all — the question banner, which shuts
 *  this to reveal the form it is pointing at ({@link ./Preview.tsx}), and the
 *  conversation changing underneath it ({@link ./state.ts}). Both are the panel
 *  taking the shelf away for a reason of its own, which is why neither can be
 *  the toggle. */
const closePreview = (): void => {
  setOpen(null)
}

return { previewing, isPreviewing, togglePreview, closePreview }
}
