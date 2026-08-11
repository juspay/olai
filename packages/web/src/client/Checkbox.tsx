/**
 * The status box beside a node's bullet — where a node has one.
 *
 * Three readings of one box — empty, half-filled, checked — the racket
 * original's three (`olai/web/checkbox.rkt`), drawn from the SAME derived
 * status the title tones with (`./tone.ts`): a done node is checked, a doing
 * node is half-marked, a `todo` node is an empty box.
 *
 * The empty box is for `todo` and ONLY for it. A node with NO mark draws no
 * box at all, and the difference between those two is the whole model: an
 * empty box on every row said every node was a to-do nobody had started, which
 * for a corpus of notes is a claim about every paragraph in it. `todo` says it
 * where someone meant it. What stays behind on an unmarked row is a blank of
 * the same width — the gutter is arithmetic (`./touch.ts`), and a title that
 * slid left on the rows nobody had marked would take its note's indent with
 * it. The blank carries no testid and no `data-status`: it is a place, not a
 * state.
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
  todo: { mark: "☐", hint: "not started", tone: "text-muted" },
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
