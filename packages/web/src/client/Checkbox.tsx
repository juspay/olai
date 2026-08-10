/**
 * The status box beside a node's bullet.
 *
 * Three readings of one box — empty, half-filled, checked — matching the
 * racket original (`olai/web/checkbox.rkt`). It draws the SAME derived status
 * the title already tones with (`./tone.ts`): a done node is checked, a doing
 * node is half-marked, an open node is an empty box that is still DRAWN. The
 * absence of a box is not a fourth state.
 *
 * Read-only for now. Toggling is keyboard-editing's job; a click handler here
 * would invent a second write path beside the ops layer that is not ready.
 * The box is a `<span>`, not a button, so nothing about it promises a click.
 */

import type { Status } from "@olai/format"

import { TESTID } from "./testids.ts"
import { CONTROL } from "./touch.ts"

const FACE: Record<Status, { readonly mark: string; readonly hint: string; readonly tone: string }> = {
  done: { mark: "☑", hint: "done", tone: "text-done" },
  doing: { mark: "◧", hint: "doing", tone: "text-doing" },
  open: { mark: "☐", hint: "not done", tone: "text-muted" },
}

export function Checkbox(props: { readonly status: Status }) {
  const face = () => FACE[props.status]
  return (
    <span
      class={`${CONTROL} select-none text-center text-[0.8125rem] leading-none md:text-[0.8125rem] ${face().tone}`}
      data-testid={TESTID.checkbox}
      data-status={props.status}
      title={face().hint}
      aria-hidden="true"
    >
      {face().mark}
    </span>
  )
}
