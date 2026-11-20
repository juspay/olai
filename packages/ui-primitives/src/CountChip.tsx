import { Show } from "solid-js"

export function CountChip(props: {
  readonly count: number
  readonly paint: string
  readonly testid: string
}) {
  return (
    <Show when={props.count > 0 && props.paint !== ""}>
      <span class={`ml-auto shrink-0 ${props.paint}`} data-testid={props.testid}>
        {props.count}
      </span>
    </Show>
  )
}
