/**
 * What ⌘Z just did, when it has something to say.
 *
 * Every other thing a write says is drawn under the row it was typed in
 * (`./RowEditor.tsx`'s `Said`), and an undo cannot be: it is pressed with no
 * draft open — the chord is dead in one — so there is no editor to hang a line
 * under, and the row a refusal is ABOUT may be somewhere else on the page, or
 * gone, which is often exactly why the undo was refused.
 *
 * So it is drawn where the reader is looking rather than where the row is:
 * pinned under the header, over the page, in the same two moods as a draft's
 * line — the alarm tone for a refusal (the reason a key did nothing) and the
 * muted one for a remark about something that happened. It does not fade on a
 * timer: the next ⌘Z clears it, and a message that vanished on its own would
 * be a refusal a person can miss by looking away, which is the thing HACKING's
 * error rule is about.
 */

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import type { Said } from "./undoing.tsx"

export function UndoSaid(props: { readonly said: Said | null }) {
  return (
    <Show when={props.said}>
      {(said) => (
        // Pointer-events off: it sits over the page, and a line of text is not
        // a thing to click — whatever is under it stays reachable.
        <div class="pointer-events-none fixed inset-x-0 top-[var(--height-header)] z-40 flex justify-center px-4">
          <p
            class="mt-2 max-w-lg rounded border bg-paper px-3 py-1.5 text-[0.8125rem] leading-snug shadow-sm"
            classList={{
              "border-alarm text-alarm": said().tone === "alarm",
              "border-rule text-muted": said().tone === "aside",
            }}
            data-testid={TESTID.undoSaid}
            data-tone={said().tone}
            role={said().tone === "alarm" ? "alert" : "status"}
          >
            {said().text}
          </p>
        </div>
      )}
    </Show>
  )
}
