/**
 * What an olai write did, in the transcript — a line, never a diff.
 *
 * The other vocabulary of `chat-edit-diffs`, and the reason there are two. A
 * `.jsonl` diff is one enormous line per node with everything on it changing at
 * once, which is the shape the format bought line-based merges with and exactly
 * the shape nobody can read — so the commit panel has never shown one, and
 * neither does this. The unit is the NODE and what changed about it.
 *
 * The words are the ones the commit panel draws ({@link ../changes.ts}), which
 * is the parity HACKING.md asks for: the agent marks a node done, this row says
 * *marked done*, and the row waiting to be committed says *marked done*. One
 * event, one sentence, two places it is seen.
 *
 * The NUDGE rides underneath when there is one — what the rollup noticed about
 * a write that landed, which is advice and never a reason anything failed. It
 * is drawn in the same aside tone the keyboard's own writes use, because a
 * person who asked an agent for something deserves what a person who pressed a
 * key already gets.
 */

import type { Wrote as Written } from "@olai/surface"
import { Show } from "solid-js"

import { GLYPH, SAID } from "../changes.ts"
import { TESTID } from "../testids.ts"
import { Reference } from "./Reference.tsx"

export function Wrote(props: { readonly wrote: Written }) {
  /** A write that changed no record has no honest word for what it did, and
   *  this is what it says instead — the one case the table cannot cover. */
  const said = () => (props.wrote.sort === null ? "nothing changed" : SAID[props.wrote.sort])
  const glyph = () => (props.wrote.sort === null ? "·" : GLYPH[props.wrote.sort])

  return (
    <div
      class="border-t border-rule px-2 py-1 text-xs"
      data-testid={TESTID.chatWrote}
      data-sort={props.wrote.sort ?? "unchanged"}
    >
      <p class="flex items-baseline gap-2">
        <span class="w-3 shrink-0 text-muted" aria-hidden="true">{glyph()}</span>
        {/* The node itself, and pressing it shows you the row: this is the
            reference a transcript carries most often, because every write the
            agent makes through the ops layer draws one of these. `id` is the
            reply's own — a row that came back without one says the same words
            and simply does not point. */}
        <Show
          when={props.wrote.id}
          fallback={<span class="min-w-0 truncate text-ink">{props.wrote.title}</span>}
        >
          {(id) => (
            <Reference id={id()} class="min-w-0 truncate">
              {props.wrote.title}
            </Reference>
          )}
        </Show>
        <span class="ml-auto shrink-0 text-muted">{said()}</span>
      </p>
      {/* Which outline it landed in, quietly: one directory is many files, and
          a person watching an agent work is entitled to know which one moved
          without unfolding the arguments. */}
      <Show when={props.wrote.file}>
        {(file) => (
          <p class="pl-5 font-mono text-[0.6875rem] text-muted/70">{file()}</p>
        )}
      </Show>
      <Show when={props.wrote.nudge}>
        {(nudge) => (
          <p class="pl-5 text-muted" data-testid={TESTID.chatNudge}>{nudge()}</p>
        )}
      </Show>
    </div>
  )
}
