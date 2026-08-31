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
 * THE THREE GESTURES, three doors, no ambiguity: a segment OTHER than the
 * current one is the ask — the page's word goes in, even when it matches
 * the reader's default, because the ask outlives where the default stands.
 * Pressing the IN-FORCE side says nothing — the page was never asked for
 * anything it was already saying, and the gesture of matching the panel is
 * not the gesture of pinning. Handing the pick BACK is the mark's door —
 * the one place besides the two segments the browser ever draws, exactly
 * while the page holds its own say.
 *
 * The pressed-in-force no-op keeps the ask idempotent: a hand that means
 * "this page shows" cannot flip it into "this page follows" by pressing
 * twice (the page's whole tool prose is an ask).
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
import { TARGET_BOX } from "../touch.ts"

export function DoneFlip(props: { readonly file: string }) {
  const effective = (): "shown" | "hidden" =>
    doneHiddenOn(props.file) ? "hidden" : "shown"
  const own = () => doneOverride(props.file) !== undefined

  const said = (): string =>
    own()
      ? `Done: finished work here is ${effective()} — this page's own pick; ` +
        "press its mark beside the strip to follow the panel's default."
      : `Done: finished work here is ${effective()} — the panel's default.`

  const pick = (word: "shown" | "hidden"): void => {
    // Pressing the way the pick already stands says NOTHING, whichever side
    // the word stood from: the page was never asked for what it already is
    // (and "same as the panel's current say" is not a gesture of pinning —
    // a matching override is a word somebody said, not a state the panel
    // made by itself).
    if (word === effective()) return
    setDoneFor(props.file, word)
  }

  return (
    // The pick REACHED BY A SCREEN READER needs the same sentence the
    // title shows: a wrapper named by it, and the `·` marked up for
    // announcements rather than dot-driven silence.
    <span
      role="group"
      aria-label={said()}
      class="inline-flex items-center gap-1"
      data-testid={TESTID.doneFlip}
      data-file={props.file}
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
      {/* The smallest form of "this page has said its own thing": THE SAME
          mark, and the release door at once — a button: the hand gives the
          pick back to the panel here, not on the strip, so the strip's one
          press is never the undo of its own answer (the tool's asks are
          idempotent). */}
      <Show when={own()}>
        <button
          type="button"
          // The 44px target is a PHONE's rule (../touch.ts) and like every
          // nearby client in the bar the reset is spelled at the site —
          // without it the flip's flex-line carries 44px uphill on a desktop
          // triggered shape ~8px below the strip, which tips popper's fit
          // arithmetic over the scenario's boundary (menu painting the wrong
          // way up).
          class={`${TARGET_BOX} md:min-h-0 md:min-w-0 inline-flex items-center justify-center text-center font-mono text-xs text-muted hover:text-ink`}
          data-testid={TESTID.doneRelease}
          aria-label="hand this page's Done pick back to the panel"
          onClick={() => letDoneFollow(props.file)}
        >
          ·
        </button>
      </Show>
    </span>
  )
}
