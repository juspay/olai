/**
 * Which theme this browser is in, and what picking one does.
 *
 * The ELEMENT is the state: `<html data-theme="pitch">` is what the sheet keys
 * off, so the signal here mirrors that attribute rather than owning a second
 * copy of it that could disagree. That matters because the attribute is
 * written before this module exists — the shell's inline boot script puts the
 * stored pick on `<html>` while the document is still parsing (`index.html`),
 * which is the whole reason a reload does not flash chalk at somebody who
 * chose pitch. Everything on the page is deferred; a theme restored from here
 * would land after the first paint.
 *
 * Nothing about any of this reaches the server. A pick is stored in this
 * browser, the same way the agent drawer's open state is, and the served
 * directory neither knows nor cares — so two machines reading the same
 * outlines are entitled to look different.
 *
 * Storage can throw (disabled, a private window at quota) and every path here
 * degrades the same way: the pick still applies to this tab, it is just not
 * remembered.
 */

import { type Accessor, createSignal } from "solid-js"

import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  type Palette,
  paletteNamed,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "./palettes.ts"

const root = (): HTMLElement => document.documentElement

/** What `<html>` says, which is `null` for the page nobody has picked on. */
const attribute = (): string | null => root().getAttribute(THEME_ATTRIBUTE)

const store = (name: string | null): void => {
  try {
    if (name === null) localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, name)
  } catch {
    // A pick that cannot be remembered is still a pick for this tab.
  }
}

/**
 * A stored value no row offers — a theme renamed, a theme dropped, an older
 * olai's spelling — is FORGOTTEN rather than kept: the sheet has no block for
 * it, so a page left holding one would sit on the default's colours while
 * claiming to be in something else, and no chip would be lit.
 *
 * The boot script cannot do this — it is four lines in the shell and
 * deliberately knows nothing about which themes exist, so that the table stays
 * in one place. Which makes here the first moment anybody can.
 */
const forgetUnknown = (): void => {
  const named = attribute()
  if (named === null || paletteNamed(named) !== undefined) return
  root().removeAttribute(THEME_ATTRIBUTE)
  store(null)
}

const [named, setNamed] = createSignal<string>(DEFAULT_THEME)

/** The theme in force — never `null`: a page that has picked nothing is in the
 *  default, which is a theme like any other and the one the sheet's bare
 *  `:root` paints. It is what lights a chip. */
export const currentTheme: Accessor<string> = named

/** The palette in force. Falls back to the default only if the attribute names
 *  something unknown, which `forgetUnknown` has already ruled out — the
 *  fallback is here so this returns a `Palette` rather than a maybe. */
export const currentPalette = (): Palette =>
  paletteNamed(named()) ?? DEFAULT_PALETTE

/**
 * The browser chrome — a phone's status bar, an installed window's title bar —
 * follows the paper.
 *
 * Read off the TABLE rather than out of `getComputedStyle`, because the table
 * is what painted the paper in the first place and a second reading of the
 * same fact can only ever be the one that is a frame behind. The shell ships
 * the default's paper in the tag it writes, so the chrome is right on the
 * first paint of a page nobody has picked on.
 */
const paintChrome = (palette: Palette): void => {
  const meta =
    document.querySelector('meta[name="theme-color"]') ??
    document.head.appendChild(
      Object.assign(document.createElement("meta"), { name: "theme-color" }),
    )
  meta.setAttribute("content", palette.colors.paper)
}

/** Pick a theme. Writes the attribute the sheet keys off, remembers it in this
 *  browser, and repaints the chrome around the page.
 *
 *  Picking the DEFAULT is a pick like any other and is stored as one: the
 *  alternative — storing nothing, so that the page falls back — would make
 *  "chalk" mean two different things, and a later change of default would
 *  silently move everybody who had chosen the old one. */
export const pickTheme = (name: string): void => {
  const palette = paletteNamed(name)
  if (palette === undefined) return
  root().setAttribute(THEME_ATTRIBUTE, palette.name)
  store(palette.name)
  setNamed(palette.name)
  paintChrome(palette)
}

/**
 * Take up whatever the boot script left on `<html>`.
 *
 * Called once, from the client's entry point, for the same reason
 * `trackVisibleViewport` is: it is a property of the DOCUMENT and it lives
 * exactly as long as the document does. Three things happen in one place —
 * a value no theme offers is forgotten, the signal takes up what survived, and
 * the chrome is repainted, since the shell could only ship the DEFAULT's paper
 * in a tag it wrote before anybody's pick was known.
 */
export const adoptStoredTheme = (): void => {
  forgetUnknown()
  const palette = paletteNamed(attribute() ?? DEFAULT_THEME) ?? DEFAULT_PALETTE
  setNamed(palette.name)
  paintChrome(palette)
}
