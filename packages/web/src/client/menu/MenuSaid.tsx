/**
 * The line beside the `•••`: what the last verb had to say (`./picking.ts`).
 *
 * Drawn by the ROW rather than by the panel, because the panel is gone by the
 * time most of these arrive — a message inside something that has gone is a
 * message nobody reads.
 *
 * Named for the surface it belongs to, the way `edit/UndoSaid.tsx` is: `Said`
 * on its own is the TYPE every one of these lines carries (`edit/undoing.ts`),
 * and a component wearing the same word made the one file where both meet
 * import the type under an alias to tell them apart.
 */

import { Show } from "solid-js"

import type { Said } from "../edit/undoing.ts"
import { LAYER } from "../layer.ts"
import { TESTID } from "../testids.ts"

export function MenuSaid(props: { readonly said: Said | null }) {
  return (
    <Show when={props.said}>
      {(message) => (
        // Absolute, like the panel: the gutter's width is shared by every row
        // in the tree (`../touch.ts`), and a word that widened it would move
        // the whole outline sideways for a few seconds. It WRAPS, because a
        // refusal is a sentence rather than a word — the ops layer names the
        // node and says what to do about it — and a line that never wrapped
        // would run off the right of the screen with the reason on it.
        <span
          class={`absolute left-0 top-full ${LAYER.row} mt-0.5 max-w-[24rem] w-max rounded border border-rule/70 bg-panel px-2 py-1 text-xs shadow-md`}
          classList={{
            "text-alarm": message().tone === "alarm",
            "text-muted": message().tone === "aside",
          }}
          data-testid={TESTID.nodeMenuSaid}
          // WHICH mood, as a fact in the markup rather than as a colour: the
          // red is a styling decision a refactor may change, and a scenario
          // asking "was that a refusal or a remark" must not be asking about a
          // class name.
          data-tone={message().tone}
          // Announced, never focus-stealing — the reader's pointer is on the
          // row and their place in the outline is not ours to take. A refusal
          // is an alert, a remark is not: the difference is whether it
          // interrupts what a screen reader is already saying.
          role={message().tone === "alarm" ? "alert" : "status"}
          aria-live={message().tone === "alarm" ? "assertive" : "polite"}
        >
          {message().text}
        </span>
      )}
    </Show>
  )
}
