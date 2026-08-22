/**
 * The chrome AROUND the page: a phone's status bar, an installed window's title
 * bar, the strip a browser paints above and below what it is showing, and the
 * tab's own mark.
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
 * ships the default's paper in a tag it writes (`index.html`) and the install
 * mark as a file, so this is right on the first paint of a page nobody has
 * picked on, and this only ever catches it up.
 *
 * The tab mark is a blob, not a `data:` URL. The shell's CSP names `blob:` on
 * `img-src` (favicons count) and refuses `data:` — a hole a note could walk
 * through — so the mark that follows a pick has to be a blob the page minted
 * or it is not a mark the tab can show.
 */

import { markSvg } from "./mark.ts"
import type { Palette } from "./palettes.ts"

const THEME_COLOR = "theme-color"
const ICON_REL = "icon"

/** The tag, found once. It is made if the shell did not ship one — a page
 *  whose chrome went unpainted because a `<meta>` was deleted would be a
 *  silent nothing — and then held, because it is never removed and a
 *  document-wide query per pick buys nothing. */
let meta: Element | undefined

const tag = (): Element => {
  meta ??=
    document.querySelector(`meta[name="${THEME_COLOR}"]`) ??
    document.head.appendChild(
      Object.assign(document.createElement("meta"), { name: THEME_COLOR }),
    )
  return meta
}

/** The tab's `<link rel="icon">`, found once, same reason as {@link tag}. */
let iconLink: HTMLLinkElement | undefined
/** The blob this tab is showing, so a pick can revoke the last one. */
let iconUrl: string | undefined

const icon = (): HTMLLinkElement => {
  if (iconLink !== undefined) return iconLink
  const existing = document.querySelector<HTMLLinkElement>(
    `link[rel="${ICON_REL}"]`,
  )
  if (existing !== null) {
    iconLink = existing
    return existing
  }
  iconLink = Object.assign(document.createElement("link"), {
    rel: ICON_REL,
    type: "image/svg+xml",
  })
  document.head.appendChild(iconLink)
  return iconLink
}

const paintIcon = (palette: Palette): void => {
  const url = URL.createObjectURL(
    new Blob([markSvg(palette)], { type: "image/svg+xml" }),
  )
  const previous = iconUrl
  icon().href = url
  iconUrl = url
  if (previous !== undefined) URL.revokeObjectURL(previous)
}

/** Put the chrome in this palette. */
export const paintChrome = (palette: Palette): void => {
  tag().setAttribute("content", palette.colors.paper)
  paintIcon(palette)
}
