/**
 * A date a node carries, as a badge.
 *
 * Printed verbatim, because the format stores it verbatim: a date-only
 * `2026-08-10` put through an instant and back would come out a datetime, and
 * a badge is not a good reason to be the first place in this codebase that
 * parses one.
 *
 * ## What it prints is what it was HANDED
 *
 * The prop is `says` rather than `date`, and the word is the whole promise:
 * this file prints a string beside a title and reads none of it. Nearly
 * everywhere that string IS the node's date — a tree row, a day entry, a
 * zoomed heading. On the agenda's spine it is one fact the day heading has not
 * already given: "3 days late" under a day that has gone, "14:00" on a
 * datetime (`@olai/format`'s `owedFact`, where the counting happens). The
 * verbatim principle above is what makes that safe rather than a leak — a pill
 * that worked out how late something was would be a component doing date
 * arithmetic; a pill handed the sentence is still printing what it was given.
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
 * already is. That it becomes a `<button>` without anything else about it
 * moving, and where a caller offers one at all, is {@link ./Pill.tsx}'s: the
 * box a fact sits in beside a title, shared with the repeat rule's badge.
 * What is THIS file's is the two things above — the words, verbatim, and the
 * one thing they say in colour.
 */

import type { Occasion } from "@olai/format"
import { Show } from "solid-js"

import { Pill } from "./Pill.tsx"
import { TESTID } from "./testids.ts"

export function DateBadge(props: {
  /** What the pill PRINTS. Verbatim, and decided by whoever knows what this
   *  surface has already said — see the header. */
  readonly says: string
  /** Which of the node's dates this is. Absent means the `date` field, which
   *  is what a tree row draws and needs no saying. */
  readonly occasion?: Occasion
  /** Whether the node this date belongs to is overdue. Decided where the node
   *  is — a badge is handed a string and could not ask the question itself —
   *  and REQUIRED, so a new place that draws a pill has to answer rather than
   *  inherit "not late" from having said nothing. */
  readonly overdue: boolean
  /** Open the date picker on this node. Absent wherever the row is drawn
   *  read-only, and then the pill is a `<span>` again ({@link ./Pill.tsx}). */
  readonly onPick?: () => void
}) {
  const occasion = (): Occasion => props.occasion ?? "date"

  return (
    <Pill
      testid={TESTID.date}
      classList={{
        "bg-alarm/15 text-alarm": props.overdue,
        "bg-pill text-muted": !props.overdue,
      }}
      attrs={{ "data-occasion": occasion(), "data-overdue": String(props.overdue) }}
      onPick={props.onPick}
      title={props.onPick === undefined ? undefined : "change the date"}
    >
      <Show when={occasion() !== "date"}>
        <span class="mr-1 opacity-70">{occasion()}</span>
      </Show>
      {props.says}
    </Pill>
  )
}
