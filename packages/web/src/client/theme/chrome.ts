/**
 * The chrome AROUND the page: a phone's status bar, an installed window's title
 * bar, the strip a browser paints above and below what it is showing.
 *
 * Its own file because it is its own job. `state.ts` answers which theme this
 * browser is in and knows nothing about `<meta>` tags; this knows what a
 * browser reads to colour its own furniture and nothing about how a theme is
 * picked or stored. They meet at one call, and each is free to grow — the iOS
 * status-bar style is a second tag on this side, not a second concern on that
 * one.
 *
 * Painted from the PALETTE rather than from `getComputedStyle`, because the
 * palette is what painted the page in the first place: a second reading of the
 * same fact can only ever be the reading that is a frame behind. The shell
 * ships the default's paper in a tag it writes (`index.html`), so this is right
 * on the first paint of a page nobody has picked on, and this only ever
 * catches it up.
 */

import type { Palette } from "./palettes.ts"

const NAME = "theme-color"

/** The tag, made if the shell did not ship one — a page whose chrome went
 *  unpainted because a `<meta>` was deleted would be a silent nothing. */
const tag = (): Element => {
  const existing = document.querySelector(`meta[name="${NAME}"]`)
  if (existing !== null) return existing
  const meta = document.createElement("meta")
  meta.setAttribute("name", NAME)
  return document.head.appendChild(meta)
}

/** Put the chrome in this palette. */
export const paintChrome = (palette: Palette): void => {
  tag().setAttribute("content", palette.colors.paper)
}
