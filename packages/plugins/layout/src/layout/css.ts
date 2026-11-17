/**
 * Publish the reader's directory width as a CSS custom property on `:root`.
 *
 * The sidebar column and the padding the layout reserves for it both read
 * `--width-sidebar`. Setting it here — once, from the preference signals — is
 * what keeps those two sides from drifting apart.
 */

import { createEffect,onCleanup } from "solid-js"

import { RAIL_WIDTH_PX } from "./prefs.ts"
import { desktop,sidebarOpen,sidebarWidth } from "./live.ts"

/** Keep `--width-sidebar` in step with the preferences, and `--height-strip`
 *  in step with whether the seat above the panes is filled (`filled`) on a
 *  desktop — the tab strip's token then, nothing otherwise. */
export const publishLayoutCss = (filled: () => boolean = () => false, thumbed: () => boolean = () => false): void => {
  const style = document.documentElement.style
  const previous = ["--width-sidebar", "--height-strip", "--height-bottom-chrome"].map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)] as const)
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
    // The thumb bar is the phone's: a desktop reserves nothing at its foot.
    root.style.setProperty("--height-bottom-chrome", thumbed() && !desktop() ? "var(--height-thumbs)" : "0px")
  })
}
