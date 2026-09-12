/** This row's drawing, contributed for the lifetime of its glyph component. */
export function KindGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" aria-hidden="true">{DocumentPaths()}</svg>
}

function DocumentPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.5 12.25 V3.75 L5.75 9.75 L9 3.75 V12.25" />
      <path d="M12.5 3.75 V10.5" />
      <path d="M10.5 8.5 L12.5 11.5 L14.5 8.5" />
    </g>
  )
}
