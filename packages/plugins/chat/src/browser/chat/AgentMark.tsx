import type { JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

import { markOf } from "../marks.ts"
import { TESTID } from "../../testids.ts"

const GenericMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.4" fill="none">
    <circle cx="8" cy="8" r="5.6" />
    <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
  </g>
)

export const MARK = "size-3.5 shrink-0"

export function AgentMark(props: { readonly id: string }) {
  const known = () => markOf(props.id)
  return (
    <svg
      viewBox="0 0 16 16"
      class={MARK}
      aria-hidden="true"
      data-testid={TESTID.chatAgentMark}
      data-mark={known() === undefined ? "generic" : props.id}
    >
      <Dynamic component={known() ?? GenericMark} />
    </svg>
  )
}
