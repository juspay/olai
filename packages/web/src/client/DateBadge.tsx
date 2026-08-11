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
 */

import type { Occasion } from "@olai/format"
import { Show } from "solid-js"

import { TESTID } from "./testids.ts"

export function DateBadge(props: {
  readonly date: string
  /** Which of the node's dates this is. Absent means the `date` field, which
   *  is what a tree row draws and needs no saying. */
  readonly occasion?: Occasion
}) {
  const occasion = (): Occasion => props.occasion ?? "date"

  return (
    <span
      class="shrink-0 rounded-full border border-rule px-2 text-xs text-muted"
      data-testid={TESTID.date}
      data-occasion={occasion()}
    >
      <Show when={occasion() !== "date"}>
        <span class="mr-1 opacity-70">{occasion()}</span>
      </Show>
      {props.date}
    </span>
  )
}
