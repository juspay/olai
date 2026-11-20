import type { JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

import { markOf } from "../marks.ts"
import { TESTID } from "../../testids.ts"
import { MARK } from "./AgentMark.tsx"

const GenericMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round">
    <rect x="2.6" y="5.2" width="10.8" height="8.4" rx="1.4" />
    <line x1="5.6" y1="5.2" x2="5.6" y2="2.4" />
    <line x1="10.4" y1="5.2" x2="10.4" y2="2.4" />
  </g>
)

export function PluginMark(props: { readonly name: string }) {
  const own = () => markOf(props.name)
  return (
    <svg
      viewBox="0 0 16 16"
      class={MARK}
      aria-hidden="true"
      data-testid={TESTID.chatPluginMark}
      data-mark={own() === undefined ? "generic" : props.name}
    >
      <Dynamic component={own() ?? GenericMark} />
    </svg>
  )
}
