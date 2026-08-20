/**
 * THE PALETTE ASKING SOMETHING FIRST — the two questions it can put in place of
 * its list, and the one rule they share.
 *
 * A command that needs a second thing before it can run stays in the box the
 * reader chose it in: the list goes, the words appear where it was, and Enter
 * answers THIS rather than whatever the list would have taken
 * (`./Palette.tsx`'s `confirm`). That is olai's own chrome and not the
 * browser's, for the reason every other panel here is: a modal drawn over a
 * refusal is the silent failure this app is written against.
 *
 * ## Two kinds, and the difference is WHERE THE CARET GOES
 *
 * A CONFIRM is a yes or a no about a write whose reach is bigger than the row
 * it was chosen on — `Move to Trash`, with the `•••` menu's sentence verbatim.
 * It takes the caret onto its own button, because the answer is a press and a
 * question nobody's keyboard can reach is one only a mouse may answer.
 *
 * A NAME is a line of text, and the caret belongs in the box it is typed in —
 * which is the palette's OWN box, already under the reader's hands
 * (`../pins/naming.ts`). So this arm draws the words and the two ways out and
 * deliberately grabs nothing: the input above is where the answer is being
 * written, and stealing focus from it would make the panel unusable by the one
 * gesture it exists for.
 *
 * The buttons are the same two either way, because a pointer needs both
 * whichever kind is up, and the Tab trap that cycles them is the palette's
 * (there is one focus trap for this dialog, not one per panel).
 */

import { Show } from "solid-js"

import type { Edit } from "@olai/surface"

import type { Naming } from "../pins/naming.ts"
import { ALARM_PILL, QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"

/**
 * A QUESTION THAT IS UP, and everything answering it needs.
 *
 * Resolved at the ONE site that knows the row is a command with something to
 * ask, rather than kept as the row itself. A row is a wider thing than this
 * panel can use: most of them are navigation, none of those has a question,
 * and holding one here would mean the panel asking `action.kind === "edit"`
 * again and needing an answer for the case it is never in.
 */
export type Asking =
  | {
    readonly kind: "confirm"
    /** The verb's own words, on the button that goes ahead. */
    readonly label: string
    readonly question: string
    readonly edit: Edit
  }
  | {
    readonly kind: "name"
    readonly label: string
    readonly question: string
    /** What the box holds greyed — the name this door takes with nothing
     *  typed, so "Enter with nothing" is a thing the reader can see. */
    readonly placeholder: string
    /** Which pin the answer is about, and the whole of what it writes
     *  (`../pins/naming.ts`'s `namedEdit`). */
    readonly naming: Naming
  }

export function Question(props: {
  readonly asking: Asking
  readonly onGo: () => void
  readonly onCancel: () => void
  /** The palette's own two refs: its Tab trap cycles these, because a dialog
   *  has one focus trap and not one per panel. */
  readonly setGo: (element: HTMLButtonElement) => void
  readonly setCancel: (element: HTMLButtonElement) => void
}) {
  return (
    <div class="px-4 py-3" role="group" aria-label={props.asking.question}>
      {/* ANNOUNCED, and not only drawn. The caret is in the box when the verb
          is chosen, so without this a reader who cannot see the panel is told
          nothing at all and their next Enter archives a subtree. `alert` +
          `assertive` is the same pair a refusal gets one row up — this is the
          other sentence in this palette that must interrupt. */}
      <p
        class="m-0 text-xs leading-snug text-ink"
        data-testid={TESTID.paletteConfirm}
        role="alert"
        aria-live="assertive"
      >
        {props.asking.question}
      </p>
      <div class="mt-2 flex gap-2">
        <Show
          when={props.asking.kind === "confirm"}
          fallback={
            <button
              type="button"
              ref={props.setGo}
              class={`${QUIET_PILL} cursor-pointer`}
              data-testid={TESTID.paletteItem}
              data-id="go"
              onClick={() => props.onGo()}
            >
              {props.asking.label}
            </button>
          }
        >
          <button
            type="button"
            // AND THE CARET COMES IN, which is the `•••` menu's own confirm
            // rule (`../menu/Confirm.tsx`): a question nobody's keyboard can
            // reach is a question only a mouse may answer, and the palette's
            // Tab trap made that literal. A microtask because the element is
            // not in the document at the instant the ref runs. The naming arm
            // above does NOT do this: its answer is typed, and the caret is
            // already where it is typed.
            ref={(element) => {
              props.setGo(element)
              queueMicrotask(() => element.focus())
            }}
            class={`${ALARM_PILL} cursor-pointer`}
            data-testid={TESTID.paletteItem}
            data-id="go"
            onClick={() => props.onGo()}
          >
            {props.asking.label}
          </button>
        </Show>
        <button
          type="button"
          ref={props.setCancel}
          class={`${QUIET_PILL} cursor-pointer`}
          data-testid={TESTID.paletteItem}
          data-id="cancel"
          onClick={() => props.onCancel()}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
