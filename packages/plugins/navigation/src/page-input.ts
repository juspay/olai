import { editKey, isEditingTarget } from "@olai/web/client/keys.ts"
import { PAGE_SUBJECT, type Navigation } from "./index.ts"

/** Row handlers have no common command dispatcher. Limit this DOM guard to
 * controls explicitly owned by a page reading (including its portalled menus).
 * Links, browser keys, navigation, and input outside that scope remain usable.
 * Palette writes and global page commands are gated at their dispatchers.
 */
export function guardPageInput(navigation: Pick<Navigation, "info">): () => void {
  const events = ["keydown", "beforeinput", "pointerdown", "click", "dblclick"] as const
  const guard = (event: Event) => {
    if (!(event.target instanceof Element)) return
    const subject = event.target.closest(`[${PAGE_SUBJECT}]`)
    if (subject === null || event.target.closest("a[href]") !== null) return
    const report = navigation.info(Number(subject.getAttribute(PAGE_SUBJECT)))
    if (report?.pending !== true) return
    if (event.type === "keydown") {
      if (!isEditingTarget(event.target)) return
      const action = editKey(event as KeyboardEvent, event.target.tagName === "TEXTAREA" ? "block" : "line")
      // Unbound chords belong to the browser; these three are escape routes.
      if (action === null || action === "cancel" || action === "zoomIn" || action === "zoomOut") return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  for (const type of events) window.addEventListener(type, guard, true)
  return () => {
    for (const type of events) window.removeEventListener(type, guard, true)
  }
}
