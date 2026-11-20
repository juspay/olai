import { createEffect,onCleanup } from "solid-js"

import { RAIL_WIDTH_PX } from "./prefs.ts"
import { desktop,phoneTabs,sidebarOpen,sidebarWidth } from "./live.ts"

/** Keep `--width-sidebar` in step with the preferences, `--height-strip`
 *  in step with whether the seat above the panes is filled (`filled`) on a
 *  desktop, and the document's own `scroll-padding-top` in step with the
 *  chrome a phone pins over the page. */
export const publishLayoutCss = (filled: () => boolean = () => false, thumbed: () => boolean = () => false): void => {
  const style = document.documentElement.style
  const previous = ["--width-sidebar", "--height-strip", "--height-bottom-chrome", "scroll-padding-top"].map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)] as const)
  onCleanup(() => {
    for (const [name, value, priority] of previous) {
      if (value) style.setProperty(name, value, priority)
      else style.removeProperty(name)
    }
  })
  createEffect(() => {
    const root = document.documentElement
    const side = sidebarOpen() ? sidebarWidth() : RAIL_WIDTH_PX
    root.style.setProperty("--width-sidebar", `${side}px`)
    root.style.setProperty("--height-strip", filled() && desktop() ? "var(--height-tabs)" : "0px")
    root.style.setProperty("--height-bottom-chrome", thumbed() && !desktop() ? "var(--height-thumbs)" : "0px")
    if (desktop()) root.style.removeProperty("scroll-padding-top")
    else {
      root.style.setProperty("scroll-padding-top",
        phoneTabs() ? "calc(var(--height-header) + var(--height-tabs))" : "var(--height-header)")
    }
  })
}
