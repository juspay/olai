/**
 * A date a node carries, as a badge.
 *
 * Printed verbatim, because the format stores it verbatim: a date-only
 * `2026-08-10` put through an instant and back would come out a datetime, and
 * a badge is not a good reason to be the first place in this codebase that
 * parses one.
 *
 * One component, so a row and that row's own page carry the same badge — and
 * the `date` testid stays one promise rather than two spellings of it.
 *
 * A date on a day PAGE has one more thing to say: which of the node's dates it
 * is (`@olai/format`'s `Occasion`). A tree row shows the `date` field and
 * nothing else, so it says nothing; a day collects the scheduled and the
 * finished side by side, and a row that did not say which it was would leave
 * the reader to work it out from a timestamp. It is a word in front of the
 * date inside the same pill — the mark's own name, the one the checkbox draws
 * — rather than a second thing on the line: the answer is quiet, or it is
 * chrome.
 *
 * ## The one thing it says in COLOUR
 *
 * A date the node is late on takes the attention tone, wherever the pill is
 * drawn — a tree row, a day entry, a zoomed heading, the agenda. That is the
 * whole visible half of `overdue` (`@olai/format`'s `isOverdue`, the predicate
 * spelled once and read everywhere), and it is on the DATE because the date is
 * what has stopped being true: the mark still says what it says, and a row that
 * recoloured its title would be saying something about the work rather than
 * about the day it was owed on. An OCCURRENCE never takes it — a dated bullet
 * is not late work — so a pill that turns amber is always somebody's `todo` or
 * `doing`.
 *
 * `data-overdue` carries the fact, always, in both directions: the tone is a
 * styling decision a refactor may change and "is this row late" is not.
 *
 * ## And the one thing it can BE
 *
 * Where a caller offers `onPick`, the pill is the way into the date picker —
 * the affordance the roadmap's `parity-date` asked for, on the thing the date
 * already is. It becomes a `<button>` and nothing else about it moves: same
 * box, same tone, same testid, same `data-` facts, so every assertion about a
 * date badge goes on being about the same element.
 *
 * WHERE it is offered is the caller's, and it is the rule a title's editability
 * already follows (`./NodeLine.tsx`): a tree row is editable, a day page and
 * the agenda are a QUERY over the set drawn read-only. `data-picks` carries
 * which of the two this pill is, so "the pill on a day page is not a control"
 * is a fact rather than an absence nobody wrote down.
 */

import type { Occasion } from "@olai/format"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { TESTID } from "./testids.ts"

export function DateBadge(props: {
  readonly date: string
  /** Which of the node's dates this is. Absent means the `date` field, which
   *  is what a tree row draws and needs no saying. */
  readonly occasion?: Occasion
  /** Whether the node this date belongs to is overdue. Decided where the node
   *  is — a badge is handed a string and could not ask the question itself —
   *  and REQUIRED, so a new place that draws a pill has to answer rather than
   *  inherit "not late" from having said nothing. */
  readonly overdue: boolean
  /** Open the date picker on this node. Absent wherever the row is drawn
   *  read-only, and then the pill is a `<span>` again. */
  readonly onPick?: () => void
}) {
  const occasion = (): Occasion => props.occasion ?? "date"
  const picks = (): boolean => props.onPick !== undefined

  return (
    // One element either way — a `<button>` when it opens something, a `<span>`
    // when it says something — rather than two branches drawing the same pill.
    <Dynamic
      component={picks() ? "button" : "span"}
      type={picks() ? "button" : undefined}
      class="shrink-0 rounded-full inset-ring px-2 text-xs"
      classList={{
        "inset-ring-alarm text-alarm": props.overdue,
        "inset-ring-rule text-muted": !props.overdue,
        "cursor-pointer hover:inset-ring-ink hover:text-ink": picks(),
      }}
      data-testid={TESTID.date}
      data-occasion={occasion()}
      data-overdue={String(props.overdue)}
      data-picks={String(picks())}
      title={picks() ? "change the date" : undefined}
      onClick={picks()
        ? (event: MouseEvent) => {
          // The row's own line answers a click by opening the title editor,
          // and this one is not about the title.
          event.stopPropagation()
          props.onPick?.()
        }
        : undefined}
    >
      <Show when={occasion() !== "date"}>
        <span class="mr-1 opacity-70">{occasion()}</span>
      </Show>
      {props.date}
    </Dynamic>
  )
}
