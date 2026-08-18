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
 * (under the editor, under the path box, under the month), and they had four
 * copies of one `<p>` between them that had already drifted in padding. What
 * differs per site is the testid and the text, so that is what it takes.
 *
 * WHAT IT IS, EXACTLY, IS A BOX: it draws {@link SaidLine} in the one mood a
 * document write has. That split is the whole of why both components exist —
 * `SaidLine` owns the MOOD (the tone, and with it the colour, the `data-tone`
 * a scenario reads, and whether a screen reader is interrupted), and this owns
 * the LAYOUT three surfaces share (a bordered box on paper, in two sizes).
 * They were two spellings of one mood until this file was made to ask for it:
 * the alarm colour, the `role="alert"` and the tone attribute were written out
 * here as well as there, which is exactly the drift `SaidLine`'s own header
 * exists to end.
 *
 * It carries no `aside` arm, and that stays deliberate: a document write has
 * no rollup to remark on, so a mood nothing emits would be a knob nobody
 * turns.
 */

import { Show } from "solid-js"

import { SaidLine } from "./edit/SaidLine.tsx"
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
        <SaidLine
          said={{ tone: "alarm", text: text() }}
          class={"m-0 rounded border border-alarm bg-paper leading-snug " +
            (props.compact === true ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-[0.8125rem]")}
          testid={props.testid}
        />
      )}
    </Show>
  )
}
