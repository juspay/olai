import { Show } from "solid-js"

import type { AnyTestId } from "@olai/ui-primitives/testids.ts"

export function Refused(props: {
  readonly said: string | null
  readonly testid: AnyTestId
  readonly compact?: boolean
}) {
  return (
    <Show when={props.said}>
      {(text) => (
        <p
          class={"m-0 rounded-control border border-alarm bg-paper leading-snug text-alarm " +
            (props.compact === true ? "px-2 py-1 text-label" : "px-3 py-1.5 text-body")}
          data-testid={props.testid}
          data-tone="alarm"
          role="alert"
        >
          {text()}
        </p>
      )}
    </Show>
  )
}
