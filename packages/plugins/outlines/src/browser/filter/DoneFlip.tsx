/**
 * The page's own say in whether finished work is drawn here: one box,
 * `finished`, beside the filter.
 *
 * TWO DOORS, ONE PICK, and the doors are different on purpose: the panel's
 * Done row (`../PreferenceRows.tsx`) is the claim about the READER — the
 * default every page stands under — while this box is the claim about the
 * PAGE, the ask that outlives where the default moves. It sits beside the
 * FILTER, not beside the tree: "what about here?" is the question it answers.
 * It stands on pages that HAVE the question — an outline's tree
 * (`../settings/done.ts`'s pageFileOf) — and the owner (`../PageView.tsx`)
 * is the one that decides.
 *
 * THREE STATES, TWO GESTURES. Ticked is shown, unticked is hidden, and either
 * press is the page's own word (`setDoneFor`) — even one that lands where the
 * default stands, because the ask outlives where the default stands today.
 * Whether the page is FOLLOWING the default or holding its own word is the
 * third state, and it is the `reset` beside the box: drawn exactly while the
 * page holds its own word, and pressing it hands the pick back to the panel
 * (`letDoneFollow`). The box never has to mean "follow", so a press on it
 * can never quietly give the page's word back.
 *
 * The ⌘O chord (`../palette/adapter.tsx`) writes the same override through the
 * same module, so the box moves with it.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import { Show } from "solid-js"

import {
  doneHidden,
  doneHiddenOn,
  doneOverride,
  letDoneFollow,
  setDoneFor,
} from "../settings/done.ts"

import { TARGET, TARGET_BOX } from "@olai/ui-primitives/touch.ts"

export function DoneFlip(props: { readonly file: string }) {
  const shown = (): boolean => !doneHiddenOn(props.file)
  const own = () => doneOverride(props.file) !== undefined
  const word = (on: boolean): string => (on ? "shown" : "hidden")

  const said = (): string =>
    own()
      ? `Finished items are ${word(shown())} on this page. Your default in Preferences ` +
        `is ${word(!doneHidden())}; press reset to follow it here.`
      : `Finished items are ${word(shown())} on this page, as your default in Preferences says.`

  return (
    <span
      role="group"
      aria-label="finished items on this page"
      class="inline-flex shrink-0 items-center gap-2"
      data-testid={TESTID.doneFlip}
      data-file={props.file}
      data-own={own() ? "true" : undefined}
      data-shown={shown() ? "true" : "false"}
      title={said()}
    >
      <label class={`${TARGET} inline-flex cursor-pointer select-none items-center gap-1.5 text-body text-muted hover:text-ink md:min-h-0`}>
        <input
          type="checkbox"
          class="size-3.5 cursor-pointer accent-ink"
          data-testid={TESTID.doneToggle}
          checked={shown()}
          aria-label="Show finished"
          onChange={(event) => setDoneFor(props.file, event.currentTarget.checked ? "shown" : "hidden")}
        />
        <span aria-hidden="true">finished</span>
      </label>
      <Show when={own()}>
        <button
          type="button"
          // The 44px target is a PHONE's rule (`@olai/ui-primitives`'
          // touch.ts), reset at the desktop breakpoint like the clear cross.
          class={`${TARGET_BOX} inline-flex items-center justify-center text-label text-muted underline decoration-rule underline-offset-2 hover:text-ink md:min-h-0 md:min-w-0`}
          data-testid={TESTID.doneRelease}
          aria-label="Reset finished items to your default"
          title={`Follow your default in Preferences: finished items ${word(!doneHidden())}`}
          onClick={() => letDoneFollow(props.file)}
        >
          reset
        </button>
      </Show>
    </span>
  )
}
