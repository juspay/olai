import { TESTID } from "olai-plugin-outlines/testids"
import { Pill } from "@olai/web/client/Pill.tsx"


export function RepeatBadge(props: {
  readonly repeat: string
  readonly onPick?: () => void
}) {
  return (
    <Pill
      testid={TESTID.repeat}
      classList={{ "bg-pill text-muted": true }}
      onPick={props.onPick}
      tip={props.onPick === undefined ? undefined : "Change repeat"}
    >
      <span class="mr-1 opacity-70" role="img" aria-label="Repeats">↻</span>
      {props.repeat}
    </Pill>
  )
}
