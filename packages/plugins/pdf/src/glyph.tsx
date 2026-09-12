/** This row's drawing, contributed for the lifetime of its glyph component. */
export function KindGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" aria-hidden="true">{PdfPaths()}</svg>
}

function PdfPaths() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 2 H4.5 A1.5 1.5 0 0 0 3 3.5 V12.5 A1.5 1.5 0 0 0 4.5 14 H11.5 A1.5 1.5 0 0 0 13 12.5 V6 Z" />
      <path d="M9 2 V6 H13" />
      <path d="M5.75 9.5 H10.25" />
      <path d="M5.75 11.75 H8.75" />
    </g>
  )
}
