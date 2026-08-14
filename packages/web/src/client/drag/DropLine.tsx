/**
 * The line that says where a dragged row would land.
 *
 * The whole affordance, and it has to say TWO things at once because the
 * gesture asks two questions: WHICH GAP (where the line sits vertically) and
 * WHAT DEPTH (where it starts horizontally). A drop indicator that only ran the
 * width of the pane would leave "last child of the branch above" and "next
 * sibling of that branch's parent" looking identical — they are the same gap —
 * and a person would find out which they had asked for after letting go.
 *
 * Positioned ABSOLUTELY out of a portal, in document coordinates. With no
 * positioned ancestor an absolute box is laid against the initial containing
 * block, which scrolls with the page — so the line stays on the gap it names
 * while a long outline is scrolled, and nothing here has to listen for that.
 *
 * What it PROMISES rides as data rather than as a shape: the parent, the
 * sibling it would follow and the depth are the three facts a scenario can hold
 * this against before the pointer is released, which is the only moment they
 * are still a prediction rather than a file.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import { TESTID } from "../testids.ts"
import type { Landing } from "./plan.ts"

export function DropLine(props: { readonly landing: Landing | null }) {
  return (
    <Show when={props.landing}>
      {(landing) => (
        <Portal>
          <div
            class="pointer-events-none absolute z-40 h-0.5 -translate-y-px rounded-full bg-accent"
            style={{
              top: `${landing().top}px`,
              left: `${landing().left}px`,
              width: `${landing().width}px`,
            }}
            data-testid={TESTID.dropLine}
            data-parent={landing().parent ?? ""}
            data-after={landing().after ?? ""}
            data-depth={String(landing().depth)}
            aria-hidden="true"
          />
        </Portal>
      )}
    </Show>
  )
}
