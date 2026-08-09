/**
 * A node's `date`, as a badge.
 *
 * Printed verbatim, because the format stores it verbatim: a date-only
 * `2026-08-10` put through an instant and back would come out a datetime, and
 * a badge is not a good reason to be the first place in this codebase that
 * parses one.
 *
 * One component, so a row and that row's own page carry the same badge — and
 * the `date` testid stays one promise rather than two spellings of it.
 */

import { TESTID } from "./testids.ts"

export function DateBadge(props: { readonly date: string }) {
  return (
    <span
      class="shrink-0 rounded-full border border-rule px-2 text-xs text-muted"
      data-testid={TESTID.date}
    >
      {props.date}
    </span>
  )
}
