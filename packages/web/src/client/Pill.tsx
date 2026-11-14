/**
 * A fact beside a title, and — where the caller offers one — the way into
 * changing it.
 *
 * Two of them: the DATE a node is on ({@link ./DateBadge.tsx}) and the RULE it
 * comes back by ({@link ./RepeatBadge.tsx}). They are the same object with
 * different words in them, and until this file they were the same object
 * twice — the `<Dynamic>` that picks the element, the `type` that has to move
 * with it, the box, the `data-picks`, and a click handler whose comment was
 * copied along with its code.
 *
 * ## The one thing it decides: a pill that PICKS is a button
 *
 * Where a caller offers `onPick` the element is a `<button>`; where none does
 * it is a `<span>`. One element either way rather than two branches drawing
 * the same box, so every assertion about a badge goes on being about the same
 * element — same box, same testid, same `data-` facts.
 *
 * WHERE it is offered is the caller's, and it is the rule a title's editability
 * already follows ({@link ./NodeLine.tsx}): a tree row is editable, a day page
 * and the agenda are a QUERY over the set drawn read-only. `data-picks` carries
 * which of the two this pill is, always and in both directions, because "the
 * pill on a day page is not a control" is a promise rather than an absence
 * nobody wrote down.
 *
 * And the click STOPS: the row's own line answers a click by opening the title
 * editor, and a pill is not about the title.
 *
 * ## What it does not decide
 *
 * The TONE. A date takes the attention tone for being late — the visible half
 * of `isOverdue` — and a repeat rule never takes one, because a rule is a claim
 * about what happens next and nothing about it can go wrong on a day. That is
 * a fact about the field, so it arrives as `classList` from the badge that
 * knows it, and this file has no opinion about colour beyond the neutral box.
 */

import { type JSX, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { Tip } from "./Tip.tsx"

export function Pill(props: {
  readonly testid: string
  /** The tone and anything else about how this pill READS — the badge's own,
   *  because what a value means is the badge's own. Merged over the neutral
   *  box below. */
  readonly classList?: Record<string, boolean | undefined>
  /** Facts the badge states about itself, `data-` and all. Spread verbatim, so
   *  a badge that wants to say which of a node's dates it is says it here
   *  rather than teaching this file about occasions. */
  readonly attrs?: Record<string, string | undefined>
  /** Open whatever changes this fact. Absent wherever the row is drawn
   *  read-only, and then the pill is a `<span>` again. */
  readonly onPick?: () => void
  /**
   * WHAT IT SAYS ON A HOVER — this app's own tip ({@link ./Tip.tsx}), never
   * the platform's, which placed a long one off the edge of the window and
   * answered nothing but a pointer.
   *
   * Where the pill PICKS, the sentence is about pressing it ("Change date")
   * and the `<button>` has already said the pressable half out loud: a role is
   * a fact a screen reader states, so nothing is added for it. Where it does
   * not pick, the pill is a `<span>` that states nothing, so the same sentence
   * goes out a second time in an `sr-only` companion below — a tip is a
   * convenience and must never be the only copy.
   */
  readonly tip?: string
  readonly children: JSX.Element
}) {
  const picks = (): boolean => props.onPick !== undefined

  // ONE pill, drawn once and WRAPPED ALWAYS — `Tip`'s `disabled` rather than
  // two arms, because a tip arriving or leaving must not replace the control
  // under the reader (a press in flight, the hover that asked for the tip).
  // The wrapper is `display: contents` and adds no box when it says nothing.
  return (
    <Tip text={props.tip ?? ""} disabled={props.tip === undefined}>
      {/* The pill FIRST: the tip reads its rectangle off the wrapper's first
          element child, and the echo after it is not the control. */}
    <Dynamic
      component={picks() ? "button" : "span"}
      type={picks() ? "button" : undefined}
      class="shrink-0 rounded-control border border-transparent px-1.5 text-caption leading-5 tabular-nums"
      classList={{ "cursor-pointer hover:text-ink": picks(), ...props.classList }}
      data-testid={props.testid}
      data-picks={String(picks())}
      {...props.attrs}
      onClick={picks()
        ? (event: MouseEvent) => {
          // The row's own line answers a click by opening the title editor,
          // and this one is not about the title.
          event.stopPropagation()
          props.onPick?.()
        }
        : undefined}
    >
      {props.children}
    </Dynamic>
      <Show when={props.tip !== undefined && !picks()}><span class="sr-only">{props.tip}</span></Show>
    </Tip>
  )
}
