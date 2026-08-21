/**
 * The line under a shortlist that says what it could not draw — one component,
 * because there is one reading and one sentence about it.
 *
 * The two doors already share their rows (`./Result.tsx`), their cursor
 * (`./cursor.ts`) and their reading (`./nodes.ts`); the sentence about how much
 * of that reading is on screen is the same kind of thing, and a second spelling
 * of it in the second door is the drift this whole seam exists against. What
 * the doors genuinely differ about is where the line SITS and how it is boxed,
 * which is why the classes are the caller's — `../SaidLine.tsx` draws the
 * same line between a sentence and its layout, and for the same reason.
 *
 * IT TAKES THE SEARCH, not two numbers, and that is the whole of what this
 * component is careful about. The numerator and the denominator are one thing
 * — an answer, and how much of it fits — and a door handed them over
 * separately would be free to count something else: the palette's list is its
 * op rows, the shelf's row and the shell ABOVE the hits, so `items().length`
 * is a number that is right in one door and wrong in the other. Handed the
 * reading itself there is nothing to get wrong, and the pair cannot come from
 * two moments (`./nodes.ts`: both are read off one answer).
 *
 * NOT A LIVE REGION, and that is a decision rather than an omission. Both doors
 * are answered as somebody types, so a polite region here would queue a fresh
 * "8 of 90 matches" behind every keystroke — a reader who has not changed their
 * mind, read to a second time (`an_answer_leaves_the_rows_standing.feature`
 * makes that argument for the refusal lines, which are announced because a
 * refusal is news). This is a READOUT beside the rows it counts: it is there to
 * be looked at, and the rows are what a screen reader is walking.
 */

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { countLine } from "./count.ts"
import type { Search } from "./nodes.ts"

export function SearchCount(props: {
  /** The reading this line is about — the hits it drew and the total it found,
   *  off the one answer that carries both. */
  readonly of: Pick<Search, "hits" | "total">
  /** Where the line sits, and how it is boxed — the door's own. */
  readonly class?: string
}) {
  const said = () =>
    countLine({ drawn: props.of.hits().length, total: props.of.total() })
  return (
    <Show when={said()}>
      {(line) => (
        <p class={props.class} data-testid={TESTID.searchCount}>{line()}</p>
      )}
    </Show>
  )
}
