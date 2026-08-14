/**
 * The second step: the question, and the two ways out of it.
 *
 * IT IS THIS PANEL'S OWN, and that is a decision rather than a convenience: a
 * `window.confirm()` is browser chrome olai does not own, cannot theme and
 * cannot say a sentence of its own inside — and it freezes the page around a
 * question about one row. So the panel swaps its content for the question, in
 * the same box under the same `•••`, and Escape or a click outside is still
 * the way out of it.
 *
 * The QUESTION is the group's accessible name as well as its text, so a reader
 * arriving on the confirm entry by keyboard is told what they are confirming
 * rather than reading the words "Move to Trash" twice. The caret goes to that
 * on mount — a panel that swapped its content under an unmoved focus would
 * leave the keyboard on an element that is no longer there. (A menu being
 * driven by a POINTER may take it straight back off again: Kobalte's list
 * follows the mouse, and the mouse is over where the entry used to be. That is
 * the primitive's own behaviour and it costs the pointer nothing — what the
 * focus was FOR is the keyboard.)
 *
 * Both ways out are `DropdownMenu.Item`s, which is what makes them reachable
 * with the arrow keys the list is walked with — and what closes the menu when
 * the verb goes ahead, since that is what an item does when it is chosen.
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { onMount } from "solid-js"

import type { MenuAction } from "./action.ts"
import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"

export function Confirm(props: {
  readonly action: MenuAction
  readonly onGo: (action: MenuAction) => void | Promise<void>
  readonly onCancel: (action: MenuAction) => void
}) {
  let go: HTMLElement | undefined
  // A MICROTASK, and it is load-bearing rather than superstitious: `onMount`
  // runs while this subtree is still being built into the open panel, so the
  // element the ref just handed over is not in the document yet and focusing
  // it does nothing at all. One tick later it is attached, the caret lands,
  // and the list this replaced has finished going away. (Without it the
  // question comes up with the caret on `<body>` — the keyboard is left
  // nowhere, which is the exact thing focusing it here is for.)
  onMount(() => queueMicrotask(() => go?.focus()))

  return (
    // A WIDTH rather than a maximum: the panel is as wide as its longest verb
    // otherwise, and a question set in that column is eight lines of two words.
    <div class="w-64 px-3 py-1.5" role="group" aria-label={props.action.confirm}>
      <p class="m-0 text-xs leading-snug text-ink" data-testid={TESTID.nodeMenuConfirm}>
        {props.action.confirm}
      </p>
      <div class="mt-2 flex gap-2">
        <DropdownMenu.Item
          ref={go}
          class="cursor-pointer rounded border border-alarm bg-transparent px-2 py-1 text-xs text-alarm hover:bg-alarm/10 focus:outline-none"
          data-testid={TESTID.nodeMenuItem}
          data-action={props.action.id}
          onSelect={() => void props.onGo(props.action)}
        >
          {props.action.label}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          class={`${QUIET_PILL} cursor-pointer focus:outline-none`}
          data-testid={TESTID.nodeMenuItem}
          data-action="cancel"
          closeOnSelect={false}
          onSelect={() => props.onCancel(props.action)}
        >
          Cancel
        </DropdownMenu.Item>
      </div>
    </div>
  )
}
