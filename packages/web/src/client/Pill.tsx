import { type JSX, Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import { Tip } from "./Tip.tsx"

export function Pill(props: {
  readonly testid: string
  readonly classList?: Record<string, boolean | undefined>
  readonly attrs?: Record<string, string | undefined>
  readonly onPick?: () => void
  readonly tip?: string
  readonly children: JSX.Element
}) {
  const picks = (): boolean => props.onPick !== undefined

  return (
    <Tip text={props.tip ?? ""} disabled={props.tip === undefined}>
    <Dynamic
      component={picks() ? "button" : "span"}
      type={picks() ? "button" : undefined}
      class="shrink-0 rounded-control border border-transparent px-1.5 text-caption leading-5 tabular-nums"
      classList={{ "cursor-pointer hover:text-ink": picks(), ...props.classList }}
      data-testid={props.testid}
      data-picks={String(picks())}
      {...props.attrs}
      onClick={picks()
        ? (event: MouseEvent) => {
          event.stopPropagation()
          props.onPick?.()
        }
        : undefined}
    >
      {props.children}
    </Dynamic>
      <Show when={props.tip !== undefined && !picks()}><span class="sr-only">{props.tip}</span></Show>
    </Tip>
  )
}
