/** Folder paths from Pierre Computer Company's IconFolder.svg, verbatim.
 * https://github.com/pierrecomputer/icons — Apache-2.0.
 * The wrapper changes black to currentColor, replaces fixed dimensions with
 * CSS sizing, and adds aria-hidden; the vendored paths are unchanged.
 * Keep this notice with the bytes. If another file vendors upstream artwork,
 * collect the notices into a NOTICE shipped at the distribution root. */
export function FolderGlyph() {
  return <svg class="h-full w-full" viewBox="0 0 18 16" preserveAspectRatio="xMinYMid meet" fill="currentColor" aria-hidden="true">{FolderPaths()}</svg>
}

function FolderPaths() {
  return (
    <path d="M3.25 1C2.00736 1 1 2.00736 1 3.25V12.75C1 13.9926 2.00736 15 3.25 15H14.75C15.9926 15 17 13.9926 17 12.75V4.75C17 3.50736 15.9926 2.5 14.75 2.5H9.91548C9.77954 2.5 9.64617 2.46306 9.5296 2.39312L7.74214 1.32064C7.39246 1.11083 6.99232 1 6.58452 1H3.25ZM2.5 3.25C2.5 2.83579 2.83579 2.5 3.25 2.5H6.58452C6.72046 2.5 6.85383 2.53694 6.9704 2.60688L8.75786 3.67936C9.10754 3.88917 9.50768 4 9.91548 4H14.75C15.1642 4 15.5 4.33579 15.5 4.75V5H2.5V3.25Z" />
  )
}
