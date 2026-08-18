/**
 * The repeat rule a node carries, as a badge beside its date.
 *
 * Printed VERBATIM, because the format stores it verbatim: the grammar is
 * spelled in the file, so `every week on monday` on screen and `every week on
 * monday` on disk are the same eight words, and there is no rendering step for
 * a reader to have to invert. That is the whole reason the grammar is English
 * rather than a cron field — a badge over `0 0 * * 1` would need a translation
 * this component would then own.
 *
 * ONE COMPONENT, so a row and that row's own page carry the same badge — and
 * the BOX it sits in is {@link ./Pill.tsx}, shared with the date badge beside
 * it: the element that becomes a `<button>` wherever a caller offers `onPick`
 * and a `<span>` where none does, with `data-picks` carrying which. What is
 * this file's is the words and the tone, and the tone is that there ISN'T one.
 * A date pill turns amber for being late; a rule is not a claim about time, it
 * is a claim about what happens next, and nothing about it can go wrong on a
 * day.
 *
 * WHY IT IS A SECOND PILL rather than a word inside the date's. The date is
 * what the agenda, the calendar and the day pages read; the rule is read by
 * nothing but the completion that spawns the next occurrence. Folding them
 * would put a fact nothing queries inside the element every date assertion is
 * about — and it would make the two unclickable apart, where they are two
 * writes at the gate and want two pickers.
 */

import { Pill } from "./Pill.tsx"
import { TESTID } from "./testids.ts"

export function RepeatBadge(props: {
  readonly repeat: string
  /** Open the repeat picker on this node. Absent wherever the row is drawn
   *  read-only — a day page and the agenda are a query over the set — and then
   *  the pill is a `<span>` again ({@link ./Pill.tsx}). */
  readonly onPick?: () => void
}) {
  return (
    <Pill
      testid={TESTID.repeat}
      classList={{ "bg-pill text-muted": true }}
      onPick={props.onPick}
      title={props.onPick === undefined
        ? `repeats ${props.repeat}`
        : "change how this repeats"}
    >
      {/* The glyph says RECURRENCE without a word of chrome, and the words say
          which one. `aria-hidden` so a screen reader reads the rule rather
          than the name of an arrow. */}
      <span class="mr-1 opacity-70" aria-hidden="true">↻</span>
      {props.repeat}
    </Pill>
  )
}
