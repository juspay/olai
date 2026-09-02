/**
 * SPACES' FACE IN A TRANSCRIPT — the mark over a fault sentence the mirror
 * delivered into somebody's conversation.
 *
 * A `<g>` of paths in a `0 0 16 16` box, `currentColor` throughout. The app
 * owns the `<svg>` around it.
 */
import type { JSX } from "solid-js"

export function SpacesMark(): JSX.Element {
  return (
    <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
      <path d="M2.5 4.5h11v7.5H6l-3.5 2.5V4.5z" />
    </g>
  )
}
