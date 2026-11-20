import type { JSX } from "solid-js"

export const PiMark = (): JSX.Element => (
  <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none">
    <path d="M 4.4 3.5 h 8 a 2.3 3.4 0 0 0 -2.3 3.4 v 5.6" />
    <line x1="7.2" y1="3.5" x2="7.2" y2="12.5" />
  </g>
)
