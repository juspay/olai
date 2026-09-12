/** This row's drawing, contributed for the lifetime of its glyph component. */
export function KindGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" aria-hidden="true">{ImagePaths()}</svg>
}

function ImagePaths() {
  return (
    <>
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="2" y="2.75" width="12" height="10.5" rx="1.5" />
        <path d="M2.75 11.5 L6.25 7.75 L8.75 10.25 L10.25 8.75 L13.25 11.75" />
      </g>
      <circle cx="10.25" cy="6" r="1" />
    </>
  )
}
