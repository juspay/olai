/**
 * Why a write did not happen, said where the person who asked for it is
 * looking.
 *
 * HACKING's error rule at the surface it applies to: a refusal is quoted
 * VERBATIM, because the ops layer's own words are the only ones that say WHY —
 * that this document has changed since it was read, that a path is already a
 * document under the served directory — and a caller that summarised them
 * would be one that threw the answer away and kept the failure.
 *
 * ONE component rather than a paragraph copied per surface. The three
 * document-writing affordances each have exactly one place to put a sentence
 * (under the editor, under the path box, beside + day note), and they had four
 * copies of one `<p>` between them that had already drifted in padding. What
 * differs per site is the testid and the text, so that is what it takes.
 *
 * It holds no MOOD, and that is the difference from the two-mood lines
 * elsewhere in this client (`edit/UndoSaid.tsx`, the `•••` menu's): those draw
 * a nudge as well as a refusal, and a document write has no rollup to remark
 * on — there is nothing an `aside` would say here that leaving the editor does
 * not already show. A component that carried a mood nothing emits would be an
 * abstraction one caller wide.
 */

import { Show } from "solid-js"

import type { TestId } from "./testids.ts"

export function Refused(props: {
  /** The ops layer's own sentence, or `null` when there is nothing to say. */
  readonly said: string | null
  readonly testid: TestId
  /** The quieter box the sidebar's column wants — the panel is 16rem wide and
   *  a page's own type size in it reads as a shout. */
  readonly compact?: boolean
}) {
  return (
    <Show when={props.said}>
      {(text) => (
        <p
          class={"m-0 rounded border border-alarm bg-paper leading-snug text-alarm " +
            (props.compact === true ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-[0.8125rem]")}
          data-testid={props.testid}
          data-tone="alarm"
          role="alert"
        >
          {text()}
        </p>
      )}
    </Show>
  )
}
