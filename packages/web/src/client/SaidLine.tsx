import type { JSX } from "solid-js"

import type { Said } from "./saying.ts"

export const ALARM_BAND =
  "m-0 border-b border-alarm/40 bg-alarm/10 py-2 text-label"

export function SaidLine(props: {
  readonly said: Said
  readonly class?: string
  readonly style?: JSX.CSSProperties
  readonly testid: string
}) {
  return (
    <p
      class={props.class}
      style={props.style}
      classList={{
        "text-alarm": props.said.tone === "alarm",
        "text-muted": props.said.tone === "aside",
      }}
      data-testid={props.testid}
      data-tone={props.said.tone}
      data-kind={props.said.kind}
      role={props.said.tone === "alarm" ? "alert" : "status"}
      aria-live={props.said.tone === "alarm" ? "assertive" : "polite"}
    >
      {props.said.text}
    </p>
  )
}
