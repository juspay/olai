/** This row's drawing, contributed for the lifetime of its glyph component. */
export function KindGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" aria-hidden="true">{HypertextPaths()}</svg>
}

function HypertextPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M5.75 4.5 L2 8 L5.75 11.5" />
      <path d="M10.25 4.5 L14 8 L10.25 11.5" />
      <path d="M9 3.25 L7 12.75" />
    </g>
  )
}
