/**
 * The page's own say in whether finished work is drawn here.
 *
 * TWO DOORS, ONE PICK, and the doors are different on purpose: the panel's
 * Done row (`../settings/Panel.tsx`) is the claim about the READER — the
 * default every page stands under — while this strip is the claim about the
 * PAGE, the ask that outlives where the default moves. The two words are the
 * panel's two words and so is the control: not a reinvention to learn, but
 * the same `Segmented` and the same gesture — the way `../menu/subtree.ts`'s
 * toggle-and-verb shared shape keeps one question one way.
 *
 * The strip sits beside the FILTER, not beside the tree: "what about here?"
 * is the question it answers; where the answer lands is the same tree the
 * box's rows come from. It stands on pages that HAVE the question — an
 * outline's tree (`../settings/done.ts`'s pageFileOf) — and the owner
 * (`../pane/PageView.tsx`) is the one that decides.
 *
 * One gesture has two readings, the deliberate part: with an override in
 * force, pressing the WAY IT ALREADY STANDS hands the page back to the
 * panel — its entry in `olai.done.overrides` deleted, because the word it
 * would say is the word the default makes nobody need to say. (The marker
 * beside the strip is what says the page holds an entry at all.)
 */

import { Show } from "solid-js"

import {
  doneHiddenOn,
  doneOverride,
  letDoneFollow,
  setDoneFor,
} from "../settings/done.ts"
import { Segmented } from "../settings/Segmented.tsx"
import { TESTID } from "../testids.ts"

export function DoneFlip(props: { readonly file: string }) {
  const effective = (): "shown" | "hidden" =>
    doneHiddenOn(props.file) ? "hidden" : "shown"
  const own = () => doneOverride(props.file) !== undefined

  const pick = (word: "shown" | "hidden"): void => {
    if (word === effective() && own()) {
      // Pressing the pressed way, while the page holds the say: hand the
      // page back to the panel. Pressing the pressed way with no override
      // is a no-op — `writePreference` settles idempotently either way.
      letDoneFollow(props.file)
      return
    }
    setDoneFor(props.file, word)
  }

  const said = (): string =>
      own()
      ? `Done: finished work here is ${
          effective()
        } — this page's own pick; press the in-force side to follow the panel's default.`
      : `Done: finished work here is ${effective()} — the panel's default.`

  return (
    <span
      class="inline-flex items-center gap-1"
      data-testid={TESTID.doneFlip}
      data-own={own() ? "true" : undefined}
      title={said()}
    >
      <Segmented
        choices={[
          { value: "shown", label: "Visible" },
          { value: "hidden", label: "Hidden" },
        ]}
        value={effective()}
        onPick={pick}
      />
      {/* The smallest form of "this page has said its own thing": one mark,
          and the strip's title holds the sentence. */}
      <Show when={own()}>
        <span aria-hidden="true" class="font-mono text-xs text-muted">
          ·
        </span>
      </Show>
    </span>
  )
}
