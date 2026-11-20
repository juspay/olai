import { TESTID } from "olai-plugin-outlines/testids"
import type { Occasion } from "@olai/format"
import { Show } from "solid-js"

import { Pill } from "@olai/web/client/Pill.tsx"


export function DateBadge(props: {
  readonly says: string
  readonly occasion?: Occasion
  readonly overdue: boolean
  readonly onPick?: () => void
}) {
  const occasion = (): Occasion => props.occasion ?? "date"

  return (
    <Pill
      testid={TESTID.date}
      classList={{
        "bg-alarm/10 text-alarm": props.overdue,
        "bg-pill text-muted": !props.overdue,
      }}
      attrs={{ "data-occasion": occasion(), "data-overdue": String(props.overdue) }}
      onPick={props.onPick}
      tip={props.onPick === undefined ? undefined : "Change date"}
    >
      <Show when={occasion() !== "date"}>
        <span class="mr-1 opacity-70">{occasion()}</span>
      </Show>
      {props.says}
    </Pill>
  )
}
