/**
 * Notes: First line / Full.
 *
 * One switch per view, beside the done switch, and it densifies rather than
 * changes: nothing is written, nothing is marked. It says which state it is
 * IN rather than which state it would move to — "First line" on a page with
 * notes folded is the honest label, and the one that still reads correctly
 * when you come back to the tab an hour later.
 *
 * Two states, like Done: Visible / Hidden. `first-line` is the default a fresh
 * reading starts in (./view.ts).
 */

import type { DescDensity } from "./view.ts"
import { TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

export function DensityToggle(
  props: {
    readonly density: DescDensity
    readonly onToggle: () => void
  },
) {
  return (
    <button
      type="button"
      // A target on a phone (./touch.ts), a pill on a laptop — same shell as
      // the done switch beside it.
      class={`inline-flex ${TARGET} shrink-0 cursor-pointer items-center rounded-full border border-rule bg-transparent px-4 py-1 text-xs text-muted hover:text-ink md:min-h-0 md:px-3`}
      data-testid={TESTID.densityToggle}
      data-density={props.density}
      aria-pressed={props.density === "full"}
      title="show each note as one line, or in full"
      onClick={() => props.onToggle()}
    >
      Notes: {props.density === "full" ? "Full" : "First line"}
    </button>
  )
}
