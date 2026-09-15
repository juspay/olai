/**
 * This row's drawing, contributed for the lifetime of its glyph component:
 * the outline's tree of bullets and lines spelled the org way — stars for
 * bullets, which is how the format's own lines begin on disk. The shapes are
 * `olai-plugin-outline-olai`'s moved, not redesigned: a sidebar of one
 * outline in two spellings reads as one THING in two spellings, and the
 * difference is specific — the `data-spelling` a test reads is the same fact
 * for the same reason.
 */
export function KindGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 16 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" data-spelling="org" aria-hidden="true">{OrgPaths()}</svg>
}

function OrgPaths() {
  return (
    <>
      <g stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none">
        <path d="M2.5 1.75V4.25M1.8 2.25L3.2 3.75M3.2 2.25L1.8 3.75" />
        <path d="M6 6.75V9.25M5.3 7.25L6.7 8.75M6.7 7.25L5.3 8.75" />
        <path d="M6 11.75V14.25M5.3 12.25L6.7 13.75M6.7 12.25L5.3 13.75" />
      </g>
      <rect x="5.5" y="2.25" width="9" height="1.5" rx="0.75" />
      <rect x="9" y="7.25" width="5.5" height="1.5" rx="0.75" />
      <rect x="9" y="12.25" width="5.5" height="1.5" rx="0.75" />
    </>
  )
}
