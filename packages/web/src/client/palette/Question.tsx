/**
 * A QUESTION, DRAWN — the words, and the two ways out of them.
 *
 * This is HOW a question looks; WHAT one is, and what answering it writes, is
 * the value it is handed (`./asking.ts`). So the panel knows nothing about a
 * trash, a pin or a name: it draws the sentence, the verb's own word on the
 * button that goes ahead, and Cancel — for every question this palette will
 * ever ask.
 *
 * The one thing it reads the KIND for is the caret, and that is a fact about
 * where an answer is written rather than about the verb: a CONFIRM is answered
 * by a press, so the caret comes onto its button; a LINE is answered by typing,
 * and the box above is already under the reader's hands, so this grabs nothing.
 *
 * The two ways out are the same two either way, because a pointer needs both
 * whichever kind is up, and the Tab trap that cycles them is the palette's
 * (there is one focus trap for this dialog, not one per panel).
 */

import type { Asking } from "./asking.ts"
import { ALARM_PILL, QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"

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
        {/* ONE BUTTON, in the two moods a question has. What differs between
            them is the mood and the caret, and both read the same one fact —
            which is what keeps two buttons from being two spellings of one
            press with different testids. */}
        <button
          type="button"
          // AND THE CARET COMES IN FOR A CONFIRM, which is the `•••` menu's
          // own rule (`../menu/Confirm.tsx`): a question nobody's keyboard can
          // reach is a question only a mouse may answer, and the palette's Tab
          // trap made that literal. A microtask because the element is not in
          // the document at the instant the ref runs. A LINE does not take it:
          // its answer is typed, and the caret is already in the box where it
          // is being typed.
          ref={(element) => {
            props.setGo(element)
            if (props.asking.kind === "confirm") {
              queueMicrotask(() => element.focus())
            }
          }}
          class={`${props.asking.kind === "confirm" ? ALARM_PILL : QUIET_PILL} cursor-pointer`}
          data-testid={TESTID.paletteItem}
          data-id="go"
          onClick={() => props.onGo()}
        >
          {props.asking.label}
        </button>
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
