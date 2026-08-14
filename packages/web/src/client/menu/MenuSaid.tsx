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
 *
 * WHAT IT OWNS IS WHERE THE LINE HANGS, and nothing else. The mood — its
 * colour, its `data-tone`, and whether a screen reader is interrupted — is
 * `../edit/SaidLine.tsx`'s, once, for every surface in this client that says
 * something about a write.
 */

import { Show } from "solid-js"

import { SaidLine } from "../edit/SaidLine.tsx"
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
        <SaidLine
          said={message()}
          class={`absolute left-0 top-full ${LAYER.row} m-0 mt-0.5 max-w-[24rem] w-max rounded border border-rule/70 bg-panel px-2 py-1 text-xs shadow-md`}
          testid={TESTID.nodeMenuSaid}
        />
      )}
    </Show>
  )
}
