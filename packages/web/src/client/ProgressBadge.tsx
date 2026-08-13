/**
 * How far the tasks under a node have got: `3/5`, beside its title.
 *
 * An ANNOTATION and nothing else. It is not a status, it does not tone the
 * title, and no checkbox is drawn from it — the box says what the node itself
 * stores, and this says what its children say. Keeping the two visibly apart
 * is the point: a parent reading `0/4` is not a task unless somebody marked it
 * one, and a parent that is `done` over `2/5` is a claim its rows can be read
 * against.
 *
 * One component, so a tree row and that row's own page carry the same badge.
 */

import type { Progress } from "@olai/format"

import { TESTID } from "./testids.ts"

export function ProgressBadge(props: { readonly progress: Progress }) {
  return (
    <span
      class="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-muted"
      data-testid={TESTID.progress}
      data-progress={`${props.progress.done}/${props.progress.total}`}
      title={`${props.progress.done} of ${props.progress.total} tasks under this are done`}
    >
      <span
        class="inline-block h-0.5 w-7 overflow-hidden rounded-full bg-pill"
        aria-hidden="true"
      >
        <span
          class="block h-full rounded-full bg-done"
          style={{
            width: `${
              props.progress.total === 0
                ? 0
                : Math.round((props.progress.done / props.progress.total) * 100)
            }%`,
          }}
        />
      </span>
      {props.progress.done}/{props.progress.total}
    </span>
  )
}
