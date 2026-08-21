/**
 * The line under a shortlist that says what it could not draw — one component,
 * because there is one reading and one sentence about it.
 *
 * The two doors already share their rows (`./Result.tsx`), their cursor
 * (`./cursor.ts`) and their reading (`./nodes.ts`); the sentence about how much
 * of that reading is on screen is the same kind of thing, and a second spelling
 * of it in the second door is the drift this whole seam exists against. What
 * the doors genuinely differ about is where the line SITS and how it is boxed,
 * which is why the classes are the caller's — `../edit/SaidLine.tsx` draws the
 * same line between a sentence and its layout, and for the same reason.
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
import { countLine, type Drawn } from "./count.ts"

export function SearchCount(props: Drawn & {
  /** Where the line sits, and how it is boxed — the door's own. */
  readonly class?: string
}) {
  const said = () => countLine({ drawn: props.drawn, total: props.total })
  return (
    <Show when={said()}>
      {(line) => (
        <p class={props.class} data-testid={TESTID.searchCount}>{line()}</p>
      )}
    </Show>
  )
}
