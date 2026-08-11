/**
 * Publish the reader's panel widths as CSS custom properties on `:root`.
 *
 * The docked chat panel and the padding the layout reserves for it both read
 * `--width-chat`; the sidebar column reads `--width-sidebar`. Setting them
 * here — once, from the preference signals — is what keeps those two sides
 * from drifting apart (the same reason `--width-chat` was a token when it was
 * a constant 26rem).
 */

import { createEffect } from "solid-js"

import { chatWidth, sidebarOpen, sidebarWidth, RAIL_WIDTH_PX } from "./prefs.ts"

/** Keep `--width-sidebar` / `--width-chat` in step with the preferences. */
export const publishLayoutCss = (): void => {
  createEffect(() => {
    const root = document.documentElement
    const side = sidebarOpen() ? sidebarWidth() : RAIL_WIDTH_PX
    root.style.setProperty("--width-sidebar", `${side}px`)
    root.style.setProperty("--width-chat", `${chatWidth()}px`)
  })
}
