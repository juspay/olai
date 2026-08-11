/**
 * The status box beside a node's bullet — where a node has one.
 *
 * Two readings of one box — half-filled, checked — matching the racket
 * original (`olai/web/checkbox.rkt`) for the two marks that survived it. It
 * draws the SAME derived status the title already tones with (`./tone.ts`): a
 * done node is checked, a doing node is half-marked.
 *
 * A node with NO status draws no box at all, and that is the whole of "a
 * bullet is not a task": the empty box this used to draw on every row said
 * every node was a to-do nobody had started, which for a corpus of notes is a
 * claim about every paragraph in it. What stays behind is a blank of the same
 * width — the gutter is arithmetic (`./touch.ts`), and a title that slid left
 * on the rows nobody had marked would take its note's indent with it. The
 * blank carries no testid and no `data-status`: it is a place, not a state.
 *
 * Read-only for now. Toggling is keyboard-editing's job; a click handler here
 * would invent a second write path beside the ops layer that is not ready.
 * The box is a `<span>`, not a button, so nothing about it promises a click.
 */

import type { Status } from "@olai/format"
import { Show } from "solid-js"

import { TESTID } from "./testids.ts"
import { CONTROL, CONTROL_SPACER } from "./touch.ts"

const FACE: Record<Status, { readonly mark: string; readonly hint: string; readonly tone: string }> = {
  done: { mark: "☑", hint: "done", tone: "text-done" },
  doing: { mark: "◧", hint: "doing", tone: "text-doing" },
}

export function Checkbox(props: { readonly status: Status | undefined }) {
  return (
    <Show
      when={props.status}
      fallback={<span class={CONTROL_SPACER} aria-hidden="true" />}
    >
      {(status) => {
        const face = () => FACE[status()]
        return (
          <span
            class={`${CONTROL} select-none text-center text-[0.8125rem] leading-none md:text-[0.8125rem] ${face().tone}`}
            data-testid={TESTID.checkbox}
            data-status={status()}
            title={face().hint}
            aria-hidden="true"
          >
            {face().mark}
          </span>
        )
      }}
    </Show>
  )
}
