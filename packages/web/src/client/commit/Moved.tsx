/**
 * Where a row's file came FROM, when it came from somewhere.
 *
 * One line of chrome, shared by both kinds of row, because a rename is one kind
 * of news whichever list it lands in — and two spellings of it is how the two
 * lists would start disagreeing about what a `git mv` looks like.
 *
 * It exists because `renamed` on its own is a word that refuses to say the
 * interesting half. The human's own vault, the morning after the `.olai`
 * migration, drew `Kept.md deleted` and nothing else: the notes were in
 * `Kept.olai` and that name was nowhere on screen. The name is the whole
 * fix — a person reads `Kept.md → Kept.olai` and knows both that
 * nothing was lost and what the commit is about to record.
 *
 * DIMMED and ahead of the name, because the row is still about the file it is
 * now: where it came from is context, and the tick, the path and the chip all
 * go on meaning what they meant.
 */

import { Show } from "solid-js"

export function Moved(props: { readonly from: string | null }) {
  return (
    <Show when={props.from}>
      {(from) => (
        <span class="shrink-0 font-mono text-xs text-muted opacity-70">
          {from()} →
        </span>
      )}
    </Show>
  )
}
