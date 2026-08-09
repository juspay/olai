/**
 * Done: Visible / Hidden.
 *
 * One switch per view, and it hides rather than changes: nothing is written,
 * nothing is marked, a hidden node is a node this reading does not draw. It
 * says which state it is IN rather than which state it would move to —
 * "Hidden" on a page with things hidden is the honest label, and the one that
 * still reads correctly when you come back to the tab an hour later.
 */

import { TESTID } from "./testids.ts"

export function DoneToggle(
  props: { readonly hidden: boolean; readonly onToggle: () => void },
) {
  return (
    <button
      type="button"
      class="shrink-0 cursor-pointer rounded-full border border-rule bg-transparent px-3 py-1 text-xs text-muted hover:text-ink"
      data-testid={TESTID.doneToggle}
      data-hidden={String(props.hidden)}
      aria-pressed={props.hidden}
      title="show or hide the nodes that are done"
      onClick={() => props.onToggle()}
    >
      Done: {props.hidden ? "Hidden" : "Visible"}
    </button>
  )
}
