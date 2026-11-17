/** The mark a plugin the vault defines wears — in the column, on its page's
 *  route (so a chat about the page wears it too), and nowhere it would be the
 *  only thing saying what a row is: every face that draws it says the name in
 *  words beside it. */
export function PluginGlyph() {
  return (
    <svg viewBox="0 0 16 16" class="size-3.5 shrink-0 text-muted" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M8 2.5v11" />
      <path d="M2.5 8h5.5" fill="currentColor" />
    </svg>
  )
}
