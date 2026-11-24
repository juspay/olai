/**
 * Publish the reader's directory width as a CSS custom property on `:root`.
 *
 * The sidebar column, the rail, and the app's name in the bar above them all
 * read `--width-sidebar`. Setting it here — once, from the preference signals —
 * is what keeps them from drifting apart. Minimized, the column is the rail's
 * own token rather than a pixel count, because the rail is drawn in `rem` and
 * a type size other than the browser's own made the two disagree.
 */

import { createEffect,onCleanup } from "solid-js"

import { desktop,phoneTabs,sidebarOpen,sidebarWidth } from "./live.ts"

/** Keep `--width-sidebar` in step with the preferences, `--height-bottom-chrome`
 *  in step with whether a phone's thumb bar is drawn (`thumbed`), and the
 *  document's own `scroll-padding-top` in step with the chrome a phone pins
 *  over the page. */
export const publishLayoutCss = (thumbed: () => boolean = () => false): void => {
  const style = document.documentElement.style
  const previous = ["--width-sidebar", "--height-bottom-chrome", "scroll-padding-top"].map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)] as const)
  onCleanup(() => {
    for (const [name, value, priority] of previous) {
      if (value) style.setProperty(name, value, priority)
      else style.removeProperty(name)
    }
  })
  createEffect(() => {
    const root = document.documentElement
    root.style.setProperty("--width-sidebar", sidebarOpen() ? `${sidebarWidth()}px` : "var(--width-rail)")
    // The thumb bar is the phone's: a desktop reserves nothing at its foot.
    root.style.setProperty("--height-bottom-chrome", thumbed() && !desktop() ? "var(--height-thumbs)" : "0px")
    // WHAT AN IN-PAGE JUMP KEEPS CLEAR. On a phone the DOCUMENT is the
    // scrollport and the bar — with the strip of tabs under it while a lane
    // has one — is pinned over its top, so a `#heading` followed there landed
    // under that chrome, with the line somebody asked for behind it. A
    // desktop's columns are their own scrollports and clear their own chrome,
    // so nothing is written there at all.
    if (desktop()) root.style.removeProperty("scroll-padding-top")
    else {
      root.style.setProperty("scroll-padding-top",
        phoneTabs() ? "calc(var(--height-header) + var(--height-tabs))" : "var(--height-header)")
    }
  })
}
