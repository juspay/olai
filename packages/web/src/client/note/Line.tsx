/**
 * A note as ONE DIM LINE under a title — the element both ways of choosing that
 * line are drawn through.
 *
 * There are two (./preview.ts and ./excerpt.ts, siblings that argue the split):
 * the top of the note, which is what a closed row shows at `Cozy`, and a window
 * around the hit, which is what a row a filter found behind its ¶ shows
 * whatever the density says. They are the SAME line — same slot, same clamp,
 * same gesture, one step dimmer than the title — so they are one element, and
 * the difference arrives as the runs it is handed plus the name it answers to.
 *
 * It was two components for a day and they were a copy: the same eleven
 * utilities, the same `title`, the same press. What that cost is the thing
 * nothing fails over — a clamp or a tone changed in one and not the other,
 * invisible from either file.
 *
 * IT IS A BUTTON, and pressing it opens the note. A clamped line is not
 * something anybody can type into, so the caret belongs to the click after this
 * one; the press STOPS, because the cell above it is the title's click-to-edit
 * target (../NodeLine.tsx).
 *
 * SOLID ELEMENTS, not `innerHTML`, which is why a note's hit is cheaper to draw
 * than a title's: a title reaches the page as an HTML string and every
 * character of it has to be escaped by hand (../markdown/tags.ts), where a run
 * handed to JSX is text the framework escapes because it cannot do anything
 * else.
 */

import { Index } from "solid-js"

import { HIT_CLASS, type Run } from "../filter/lit.ts"
import { TESTID } from "../testids.ts"
import { ROW_NOTE } from "../touch.ts"

export function NoteLine(props: {
  /** The line, as the runs it is drawn from — one unlit run for a preview,
   *  and the query's words lit for an excerpt. */
  readonly runs: ReadonlyArray<Run>
  /** This line is the REASON the row is on screen: the query's only hit is
   *  behind the ¶, so the title above holds nothing the reader typed. It is
   *  what the line answers to (`TESTID.descHit` rather than `TESTID.desc`),
   *  because "a note is clamped here" and "this row was found by its note" are
   *  two different things for a scenario to ask. */
  readonly hit?: boolean
  /** Open the note — the pilcrow's gesture, from the other end of it. Absent
   *  wherever the row draws no open state. */
  readonly onOpen?: () => void
}) {
  return (
    <button
      type="button"
      class={`mt-0.5 mb-1 block w-full max-w-full cursor-text truncate border-0 bg-transparent p-0 text-left ${ROW_NOTE}`}
      data-testid={props.hit === true ? TESTID.descHit : TESTID.desc}
      data-preview="true"
      data-open="false"
      title="show the full note"
      onClick={(event) => {
        event.stopPropagation()
        props.onOpen?.()
      }}
    >
      {/* `Index` rather than `For`: the runs are a fresh array of fresh objects
          on every keystroke, so reference keying would tear down and rebuild
          every mark and text node where position keying patches the text in
          place. */}
      <Index each={props.runs}>
        {(run) => (
          run().lit
            ? <mark class={HIT_CLASS} data-testid={TESTID.hit}>{run().text}</mark>
            : <>{run().text}</>
        )}
      </Index>
    </button>
  )
}
