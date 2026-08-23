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
 * mark as a file. The status-bar colour is right on the first paint of a page
 * nobody has picked on; the tab starts as that file, and this catches both up.
 *
 * The tab mark is a blob, not a `data:` URL: the shell's CSP names `blob:` on
 * `img-src` (favicons count) and refuses `data:`.
 *
 * TWO THINGS DECIDE THE MARK now, and they move independently: the palette in
 * force, and whether the agent is waiting on the reader
 * (`../chat/attention/badge.ts` — the tab's half of the App Badging API). So
 * this file holds what the chrome is CURRENTLY showing, and each caller says
 * only its own half. The alternative — every caller passing both — would make
 * the badge a second place that knows which theme is in force, and a theme
 * picked while a question was waiting would rub the dot out.
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

/** The tab's `<link rel="icon">`, found once — same reason the theme-color
 *  tag is. */
let iconLink: HTMLLinkElement | undefined
/** The blob this tab is showing, so a pick can revoke the last one. */
let iconUrl: string | undefined

const icon = (): HTMLLinkElement => {
  iconLink ??=
    document.querySelector<HTMLLinkElement>(`link[rel="${ICON_REL}"]`) ??
    document.head.appendChild(
      Object.assign(document.createElement("link"), {
        rel: ICON_REL,
        type: "image/svg+xml",
      }),
    )
  return iconLink
}

/** What the chrome is showing right now: the palette it was last painted in,
 *  and whether the mark carries the waiting dot. Held because the two move
 *  independently — see the header. */
let shown: Palette | undefined
let waiting = false

const paintIcon = (palette: Palette): void => {
  const url = URL.createObjectURL(
    new Blob([markSvg(palette, waiting)], { type: "image/svg+xml" }),
  )
  const previous = iconUrl
  icon().href = url
  iconUrl = url
  if (previous !== undefined) URL.revokeObjectURL(previous)
}

/** Put the chrome in this palette. */
export const paintChrome = (palette: Palette): void => {
  shown = palette
  tag().setAttribute("content", palette.colors.paper)
  paintIcon(palette)
}

/**
 * Mark the tab, or stop marking it — the same drawing, with a dot on it
 * (`./mark.ts`).
 *
 * A no-op before any palette has been painted, which is the first frame and
 * nothing else: `followStoredTheme` paints from the client's entry point,
 * before there is a panel to ask for this. Nothing is drawn from a guess — a
 * mark in a palette nobody picked is a worse answer than the file the shell
 * already shipped.
 */
export const markWaiting = (mark: boolean): void => {
  if (mark === waiting) return
  waiting = mark
  if (shown !== undefined) paintIcon(shown)
}
