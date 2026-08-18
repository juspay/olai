/**
 * The note-only hit, drawn: one dim clamped line under the title, with the
 * words the query found lit inside it.
 *
 * Where the line comes from is `./excerpt.ts`; this is the element. It sits
 * exactly where a closed row's note preview sits and behaves the same way —
 * pressing it opens the note — because it IS that line, taken around the hit
 * instead of off the top.
 *
 * SOLID ELEMENTS, not `innerHTML`, which is the whole reason a note's hit is
 * cheaper to draw than a title's: a title reaches the page as an HTML string
 * and every character of it has to be escaped by hand, where a run handed to
 * JSX is text the framework escapes because it cannot do anything else.
 */

import { For } from "solid-js"

import { HIT_CLASS, type Run } from "../filter/lit.ts"
import { TESTID } from "../testids.ts"
import { ROW_NOTE } from "../touch.ts"

export function Excerpt(props: {
  readonly runs: ReadonlyArray<Run>
  /** Open the note — the pilcrow's gesture, from the line that says there is
   *  something in there. Absent where the row draws no open state. */
  readonly onOpen?: () => void
}) {
  return (
    <button
      type="button"
      class={`mt-0.5 mb-1 block w-full max-w-full cursor-text truncate border-0 bg-transparent p-0 text-left ${ROW_NOTE}`}
      data-testid={TESTID.descHit}
      title="show the full note"
      onClick={(event) => {
        event.stopPropagation()
        props.onOpen?.()
      }}
    >
      <For each={props.runs}>
        {(run) => (
          run.lit
            ? <mark class={HIT_CLASS} data-testid={TESTID.hit}>{run.text}</mark>
            : <>{run.text}</>
        )}
      </For>
    </button>
  )
}
