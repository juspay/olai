/** This row's drawing, contributed for the lifetime of its glyph component. */
export function KindGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" aria-hidden="true">{CsvPaths()}</svg>
}

function CsvPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="2.75" width="12" height="10.5" rx="1.5" />
      <path d="M2 6.25 H14" />
      <path d="M8 6.25 V13.25" />
    </g>
  )
}
