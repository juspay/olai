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
 * TWO THINGS DECIDE THE TAB now, and they move independently: the palette in
 * force, and whether the agent is waiting on the reader
 * (`../chat/attention/badge.ts` — the tab's half of the App Badging API). So
 * this file holds what the chrome is CURRENTLY showing, and each caller says
 * only its own half. The alternative — every caller passing both — would make
 * the badge a second place that knows which theme is in force, and a theme
 * picked while a question was waiting would rub the mark out.
 *
 * The TITLE is here for the same reason the icon is, and it is the half a
 * reader would expect to find somewhere else: what the tab is CALLED is the
 * chrome around the page exactly as its icon and its status-bar colour are,
 * and the two are one mark to a person looking at a row of tabs. Owned
 * together, they cannot come apart; owned apart, "keep these two in step" is a
 * rule with nowhere to live.
 *
 * WHAT the tab is called is not this file's to invent: the shell ships
 * `olai` (`index.html` — the one spelling a static file can know), and the
 * server's own word for this deployment crosses on `app.get`
 * (`../named.ts`), landing here through {@link nameChrome} as the name the
 * mark is composed over. iOS's Add to Home Screen reads no manifest, so the
 * same landing retitles its `apple-mobile-web-app-title`: that meta is the
 * only spelling of the deployment's name an installed iPhone app ever gets.
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
 *  and whether the tab is marked. Held because the two move independently —
 *  see the header. */
let shown: Palette | undefined
let waiting = false

/** The tab's own NAME, without any mark on it — read the first time one is
 *  composed rather than at import, so a module that only wants a palette does
 *  not need a document. Nothing else in this client writes `document.title`
 *  (`../claims.test.ts` holds that), so reading it once is reading it from the
 *  one writer there is; the day there is a second, this is where they meet.
 *
 *  What the shell ships is the START of it: `named.ts` replaces it with the
 *  deployment's own word (`olai [machine]`) when the server's answer lands,
 *  through {@link nameChrome} — a mark already worn is re-composed over the
 *  new name, never lost to it. */
let name: string | undefined

/** The HOME-SCREEN word for an installed iPhone app, tagged once. Same
 *  find-or-make rule as the theme-colour tag: the shell ships it
 *  (`index.html`), and the day it stops doing so an unnamed app is worse
 *  than an unretitled one — but the tag's being here is no reason a second
 *  module should ever look for it. */
let appleTitle: Element | undefined

const apple = (): Element => {
  appleTitle ??=
    document.querySelector('meta[name="apple-mobile-web-app-title"]') ??
    document.head.appendChild(
      Object.assign(document.createElement("meta"), {
        name: "apple-mobile-web-app-title",
      }),
    )
  return appleTitle
}

/** What a marked tab wears in front of its name. A mark and not a count: the
 *  number belongs on an app icon, which is a place that has one, and `●3 olai`
 *  in a title bar reads as a typo. */
const MARK = "●"

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
 * Mark the tab, or stop marking it: BOTH halves of what a tab is — its NAME,
 * and its ICON with a dot on it (`./mark.ts`).
 *
 * One call and not two, because they are one fact about one thing. Written
 * from two places — a title where the badge picks its channel, an icon here —
 * their agreement would rest on a rule nobody enforces, and a tab reading
 * "● olai" under a clean icon is the shape that rule failing takes.
 *
 * The ICON is a no-op before any palette has been painted, which is the first
 * frame and nothing else: `followStoredTheme` paints from the client's entry
 * point, before there is a panel to ask for this. Nothing is drawn from a
 * guess — a mark in a palette nobody picked is a worse answer than the file
 * the shell already shipped.
 */
export const markWaiting = (mark: boolean): void => {
  if (mark === waiting) return
  waiting = mark
  paintTitle()
  if (shown !== undefined) paintIcon(shown)
}

/**
 * Name the deployment: THE half of the tab's title that is the app's word
 * for itself, and the iOS home-screen's word beside it. Called once, when
 * `app.get` has answered (`../named.ts`) — the name does not move again for
 * the life of the page, and the mark the tab may already be wearing is
 * re-composed over it rather than rubbed out: a question that arrived before
 * the name did is still waiting after it.
 */
export const nameChrome = (called: string): void => {
  name = called
  paintTitle()
  apple().setAttribute("content", called)
}

/** The tab's name and whatever is on it, composed. One writer, so the mark
 *  cannot be applied twice or lost by whoever writes last. */
const paintTitle = (): void => {
  name ??= document.title
  document.title = waiting ? `${MARK} ${name}` : name
}
