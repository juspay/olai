import { TESTID } from "@olai/ui-primitives/testids.ts"
import type { Progress } from "@olai/format"

import { Tip } from "./Tip.tsx"

export function ProgressBadge(props: { readonly progress: Progress }) {
  const said = (): string => `${props.progress.done} of ${props.progress.total} done`
  return (
    <Tip text={said()} say>
      <span
        class="shrink-0 tabular-nums text-label text-muted"
        data-testid={TESTID.progress}
        data-progress={`${props.progress.done}/${props.progress.total}`}
      >
        {props.progress.done}/{props.progress.total}
      </span>
    </Tip>
  )
}
