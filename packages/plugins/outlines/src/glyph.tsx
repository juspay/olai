/** This row's drawing, contributed for the lifetime of its glyph component. */
export function KindGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" aria-hidden="true">{OutlinePaths()}</svg>
}

function OutlinePaths() {
  return (
    <>
      <circle cx="2.5" cy="3" r="1" />
      <rect x="5.5" y="2.25" width="9" height="1.5" rx="0.75" />
      <circle cx="6" cy="8" r="1" />
      <rect x="9" y="7.25" width="5.5" height="1.5" rx="0.75" />
      <circle cx="6" cy="13" r="1" />
      <rect x="9" y="12.25" width="5.5" height="1.5" rx="0.75" />
    </>
  )
}
