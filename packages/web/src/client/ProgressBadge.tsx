/**
 * How far the tasks under a node have got: `3/5`, right after its title.
 *
 * An ANNOTATION and nothing else. It is not a status, it does not tone the
 * title, and no glyph is drawn from it — the glyph says what the node itself
 * stores, and this says what its children say. Keeping the two visibly apart is
 * the point: a parent reading `0/4` is not a task unless somebody marked it one,
 * and a parent that is `done` over `2/5` is a claim its rows can be read
 * against.
 *
 * IT LOST ITS BAR AND ITS FAR-RIGHT PERCH (the quiet outline, human). The little
 * filled track was a second drawing of a number that is already two digits, and
 * a badge pushed to the right edge of the pane made a section heading read as a
 * table row with a value column. It rides INLINE now, in the dim voice every
 * other fact beside a title takes (`./hot.ts`) — a byline under a headline
 * rather than a cell — which is also what lets a top-level row wear it as part
 * of its own header (`./Tree.tsx`).
 *
 * One component, so a tree row, a day entry and that row's own page carry the
 * same fraction.
 */

import type { Progress } from "@olai/format"

import { TESTID } from "./testids.ts"

export function ProgressBadge(props: { readonly progress: Progress }) {
  return (
    <span
      class="shrink-0 font-mono text-xs text-muted"
      data-testid={TESTID.progress}
      data-progress={`${props.progress.done}/${props.progress.total}`}
      title={`${props.progress.done} of ${props.progress.total} tasks under this are done`}
    >
      {props.progress.done}/{props.progress.total}
    </span>
  )
}
