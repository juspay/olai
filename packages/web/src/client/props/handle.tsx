/**
 * THE KEY HALF OF A FACT — the one thing every property renderer draws the
 * same way, wherever it draws it.
 *
 * Its own module since the BLOCK SEAM (`./blocks.ts`): a chip draws it inline
 * and a block draws it above a row it owns, and both must be the same
 * affordance — same face, same testid, same sentence, same promise. The promise
 * is `./PropsDrawer.tsx`'s and is worth repeating where the code is: THE KEY IS
 * NEVER A DOOR. Whatever a value does when you press it — open a link, open an
 * editor, open a pane — the key opens the editor, always, so there is one half
 * of every fact whose behaviour a reader never has to guess.
 */
import { Show } from "solid-js"

import { TESTID } from "../testids.ts"

export function Handle(props: { readonly label: string; readonly onOpen?: () => void }) {
  return (
    <Show
      when={props.onOpen}
      fallback={
        <span class="shrink-0 font-mono text-[0.6875rem] text-muted">{props.label}</span>
      }
    >
      {(open) => (
        <button
          type="button"
          class="shrink-0 cursor-pointer font-mono text-[0.6875rem] text-muted hover:text-accent"
          data-testid={TESTID.propKey}
          title={`change ${props.label}`}
          onClick={(event) => {
            // The row's own line answers a click by opening the title editor,
            // and this one is about the fact under the pointer.
            event.stopPropagation()
            open()()
          }}
        >
          {props.label}
        </button>
      )}
    </Show>
  )
}
