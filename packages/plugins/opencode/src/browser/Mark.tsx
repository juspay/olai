import type { JSX } from "solid-js"

export const OpencodeMark = (): JSX.Element => (
  <g
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  >
    <polyline points="3,4 7,8 3,12" />
    <line x1="8.5" y1="12" x2="13" y2="12" />
  </g>
)
