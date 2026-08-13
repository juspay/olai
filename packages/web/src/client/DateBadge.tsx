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
 */

import type { Occasion } from "@olai/format"
import { Show } from "solid-js"

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
}) {
  const occasion = (): Occasion => props.occasion ?? "date"

  return (
    <span
      class="shrink-0 rounded-full border px-2 text-xs"
      classList={{
        "border-alarm text-alarm": props.overdue,
        "border-rule text-muted": !props.overdue,
      }}
      data-testid={TESTID.date}
      data-occasion={occasion()}
      data-overdue={String(props.overdue)}
    >
      <Show when={occasion() !== "date"}>
        <span class="mr-1 opacity-70">{occasion()}</span>
      </Show>
      {props.date}
    </span>
  )
}
