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
 * Nothing about any of this reaches the server: a pick is a preference of this
 * browser's (`../preference.ts`), like the agent drawer's open state.
 */

import { type Accessor, createSignal } from "solid-js"

import { paintChrome } from "./chrome.ts"
import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  type Palette,
  paletteNamed,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "./palettes.ts"
import { writePreference } from "../preference.ts"

const root = (): HTMLElement => document.documentElement

/** What `<html>` says, which is `null` for the page nobody has picked on. */
const attribute = (): string | null => root().getAttribute(THEME_ATTRIBUTE)

const [named, setNamed] = createSignal<string>(DEFAULT_THEME)

/** The theme in force — never `null`: a page that has picked nothing is in the
 *  default, which is a theme like any other and the one the sheet's bare
 *  `:root` paints. It is what lights a chip. */
export const currentTheme: Accessor<string> = named

/** Apply a palette: the attribute the sheet keys off, the signal the picker
 *  reads, and the chrome around the page. */
const apply = (palette: Palette): void => {
  root().setAttribute(THEME_ATTRIBUTE, palette.name)
  setNamed(palette.name)
  paintChrome(palette)
}

/** Pick a theme — the whole of what a chip does.
 *
 *  Picking the DEFAULT is a pick like any other and is remembered as one: the
 *  alternative — storing nothing, so that the page falls back — would make
 *  "chalk" mean two different things, and a later change of default would
 *  silently move everybody who had chosen the old one. */
export const pickTheme = (palette: Palette): void => {
  apply(palette)
  writePreference(THEME_STORAGE_KEY, palette.name)
}

/**
 * Take up whatever the boot script left on `<html>`.
 *
 * Called once, from the client's entry point, for the same reason
 * `trackVisibleViewport` is: it is a property of the DOCUMENT and lives
 * exactly as long as the document does.
 *
 * A stored value no row offers — a theme renamed, a theme dropped, an older
 * olai's spelling — is FORGOTTEN here rather than kept: the sheet has no block
 * for it, so a page left holding one would sit on the default's colours while
 * claiming to be in something else, and no chip would be lit. The boot script
 * cannot do this; it is four lines in the shell and deliberately knows nothing
 * about which themes exist, which makes here the first moment anybody can.
 *
 * The chrome is repainted either way, because the shell could only ship the
 * DEFAULT's paper in a tag it wrote before anybody's pick was known.
 */
export const adoptStoredTheme = (): void => {
  const stored = attribute()
  const picked = stored === null ? undefined : paletteNamed(stored)
  if (stored !== null && picked === undefined) {
    root().removeAttribute(THEME_ATTRIBUTE)
    writePreference(THEME_STORAGE_KEY, null)
  }
  // The default's block lands on the bare `:root`, so a page that picked
  // nothing is already painted: this only catches the signal and the chrome up
  // with what the sheet is doing, and writes no attribute.
  const palette = picked ?? DEFAULT_PALETTE
  setNamed(palette.name)
  paintChrome(palette)
}
