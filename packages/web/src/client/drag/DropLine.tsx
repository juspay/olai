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
 * That is also what lets it be drawn over ANOTHER PANE than the one the drag
 * began in: the gap it names is a place on the page, and a portal is outside
 * every column's own overflow (`./aim.ts`).
 *
 * What it PROMISES rides as data rather than as a shape: the parent, the
 * sibling it would follow and the depth are the three facts a scenario can hold
 * this against before the pointer is released, which is the only moment they
 * are still a prediction rather than a file.
 *
 * WHETHER THERE IS ONE AT ALL is not asked here — a drag has one answer and it
 * may be the other one, so the choosing is `./Aiming.tsx`'s and what is left
 * here is one line drawn one way.
 */

import { Portal } from "solid-js/web"

import { LAYER } from "../layer.ts"
import { TESTID } from "../testids.ts"
import type { Landing } from "./plan.ts"

export function DropLine(props: { readonly landing: Landing }) {
  return (
    <Portal>
      <div
        // `LAYER.row` — it hangs off the rows, over them and under every
        // piece of chrome, which is the same claim the `•••` panel makes
        // and the reason both take that name (`../layer.ts`).
        class={`pointer-events-none absolute ${LAYER.row} h-0.5 -translate-y-px rounded-full bg-accent`}
        style={{
          top: `${props.landing.top}px`,
          left: `${props.landing.left}px`,
          width: `${props.landing.width}px`,
        }}
        data-testid={TESTID.dropLine}
        data-parent={props.landing.parent ?? ""}
        data-after={props.landing.after ?? ""}
        data-depth={String(props.landing.depth)}
        aria-hidden="true"
      />
    </Portal>
  )
}
