/**
 * Whether a row is OPEN, and who decided.
 *
 * There is one open state under a tree or day row: title, then the node's
 * properties as a run, then the note in full (`../NodeBody.tsx`). What opens it
 * is the pilcrow beside the title (`./Mark.tsx`) or — at `cozy`, where there is
 * one to press — the clamped line itself; what shuts it again is the same
 * press, a press away, or Escape.
 *
 * THREE STATES, NOT TWO, and the third is the whole of this file's shape:
 *
 *   - the reader has opened this row,
 *   - the reader has shut this row,
 *   - the reader has not touched this row — and then it is the DENSITY
 *     preference's answer (`../settings/density.ts`), read live, so a reader who
 *     picks `Open` in the preferences panel sees every untouched row unfold
 *     without a reload and without this component storing a copy of the pick.
 *
 * A single boolean cannot hold that. Seeding a boolean from the preference at
 * mount would be the same bug one frame earlier: rows are minted per place and
 * kept across frames by `Row.key` (`../Tree.tsx`), so a pick made after the tree
 * was drawn would reach exactly the rows that happened to be re-created.
 *
 * The dismissal is asked of the TOUCH rather than of the open state, and that is
 * deliberate: at `Open` every row on the page is open, and a click-away that
 * folded all of them would make the preference unusable. What a press outside
 * closes is a row this reader opened.
 *
 * Component-local, and it dies with the row that holds it. How it SHUTS is
 * `../dismiss.ts`, the one spelling of the two gestures the panels this client
 * draws itself share — so this one gained Escape by being deduped rather than
 * by being argued about. That is the model this note already documents anyway:
 * expanding and editing are one state and you leave both at once
 * (`features/keyboard_editing.feature`), and Escape has always been how a caret
 * leaves.
 */

import { type Accessor, createSignal } from "solid-js"

import { dismissOn } from "../dismiss.ts"

export interface NoteExpand {
  readonly expanded: Accessor<boolean>
  /** Toggle open/closed — the pilcrow's press, and the clamped line's. */
  readonly toggle: () => void
  /** Wire as `ref` on the note control root so "click away" can find it. */
  readonly setRoot: (el: HTMLElement | undefined) => void
  /**
   * Wire as `ref` on the PILCROW (`./Mark.tsx`), which is the one control that
   * opens this and is not inside the root above — it sits on the title line,
   * and the root is the body under it.
   *
   * Without it the mark is a press OUTSIDE an open row, so shutting one went:
   * pointerdown dismisses it, then the click that follows toggles what is now
   * shut, and the row springs straight back open. That is the exact failure
   * `../dismiss.ts` documents for a portalled trigger, met here by a trigger
   * that is merely a sibling — and answered the same way, with the same field.
   */
  readonly setTrigger: (el: HTMLElement | undefined) => void
}

export const createNoteExpand = (
  /** What an UNTOUCHED row is, read live. A thunk rather than a value because
   *  the answer is a preference this browser may change while the tree is on
   *  screen. */
  fallback: () => boolean,
): NoteExpand => {
  const [touched, setTouched] = createSignal<boolean | undefined>(undefined)
  const expanded = (): boolean => touched() ?? fallback()
  let root: HTMLElement | undefined
  let trigger: HTMLElement | undefined

  // The body is the root and the PILCROW is the trigger, which is not inside
  // it — see `setTrigger` for the bug that costs. Open only counts as a row
  // this reader OPENED: see the header for why the preference's own rows are
  // not on the dismissal stack.
  dismissOn({
    open: () => touched() === true,
    root: () => root,
    trigger: () => trigger,
    dismiss: () => setTouched(false),
  })

  return {
    expanded,
    toggle: () => setTouched(!expanded()),
    setRoot: (el) => {
      root = el
    },
    setTrigger: (el) => {
      trigger = el
    },
  }
}
