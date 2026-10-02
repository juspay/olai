import type { PageInfo } from "./index.ts"

/** A retained page may stay painted while its replacement arrives, but no
 * gesture may spend it as the requested page. Capture precedes the palette,
 * global chords and row handlers, including clicks on an already-open menu.
 *
 * The report belongs to the pane; this listener belongs to navigation's
 * activation. With no report (no layout or a different content owner), there
 * is no retained-page claim to block. Connection reachability is independent.
 */
export function guardPageInput(focused: () => PageInfo | undefined): () => void {
  const events = ["keydown", "pointerdown", "click", "dblclick", "contextmenu"] as const
  const guard = (event: Event) => {
    if (focused()?.pending !== true) return
    // A native modal owns input above the page (notably the offline dialog's
    // Reload button). Its recovery must remain usable while a page is pending.
    if (event.target instanceof Element && event.target.closest("dialog:modal") !== null) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  for (const type of events) window.addEventListener(type, guard, true)
  return () => {
    for (const type of events) window.removeEventListener(type, guard, true)
  }
}
