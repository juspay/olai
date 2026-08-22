/**
 * Which theme this browser is in, and what picking one does.
 *
 * The ELEMENT is the state: `<html data-theme="pitch">` is what the sheet keys
 * off, so the signal here mirrors that attribute rather than owning a second
 * copy of it that could disagree. That matters because the attribute is
 * written before this module exists — the shell's inline boot script puts the
 * stored pick on `<html>` while the document is still parsing (`index.html`),
 * which is the whole reason a reload does not flash the default at somebody
 * who chose pitch. Everything on the page is deferred; a theme restored from
 * here would land after the first paint.
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
import { watchPreference, writePreference } from "../preference.ts"

const root = (): HTMLElement => document.documentElement

/** What `<html>` says, which is `null` for the page nobody has picked on. */
const attribute = (): string | null => root().getAttribute(THEME_ATTRIBUTE)

const [named, setNamed] = createSignal<string>(DEFAULT_THEME)

/** The theme in force — never `null`: a page that has picked nothing is in the
 *  default, which is a theme like any other and the one the sheet's bare
 *  `:root` paints. It is what lights a chip. */
export const currentTheme: Accessor<string> = named

/**
 * Put the page in a palette: the attribute the sheet keys off, the signal the
 * picker reads, and the chrome around the page. Three things that have to stay
 * in step, so they are written down once — a fourth thing a theme touches is
 * added here or nowhere.
 *
 * `undefined` is the page NOBODY HAS PICKED ON, which is not the same fact as a
 * page naming the default: it carries no attribute at all, because the
 * default's block lands on the bare `:root`. The signal and the chrome are
 * still told, since neither has a bare `:root` to fall back on.
 */
const show = (palette: Palette | undefined): void => {
  if (palette === undefined) root().removeAttribute(THEME_ATTRIBUTE)
  else root().setAttribute(THEME_ATTRIBUTE, palette.name)
  const shown = palette ?? DEFAULT_PALETTE
  setNamed(shown.name)
  paintChrome(shown)
}

/** Pick a theme — the whole of what a chip does.
 *
 *  Picking the DEFAULT is a pick like any other and is remembered as one: the
 *  alternative — storing nothing, so that the page falls back — would make
 *  the default's name mean two different things, and a later change of
 *  default would silently move everybody who had chosen the old one. */
export const pickTheme = (palette: Palette): void => {
  show(palette)
  writePreference(THEME_STORAGE_KEY, palette.name)
}

/**
 * Take up whatever the boot script left on `<html>`, and FOLLOW the browser's
 * pick for as long as the document lives.
 *
 * Called once, from the client's entry point, for the same reason
 * `trackVisibleViewport` is: it is a property of the DOCUMENT and lives exactly
 * as long as the document does. It is named for the second half rather than the
 * first because the second half never ends — a browser is more than one tab, the
 * theme is one preference of one browser's, and a pick made next door is this
 * tab's pick too, taken up as it happens rather than at the next reload
 * (../preference.ts says why that wait was a bug).
 *
 * A stored value no row offers — a theme renamed, a theme dropped, an older
 * olai's spelling — is FORGOTTEN on the way in rather than kept: the sheet has
 * no block for it, so a page left holding one would sit on the default's
 * colours while claiming to be in something else, and no chip would be lit. The
 * boot script cannot do this; it is four lines in the shell and deliberately
 * knows nothing about which themes exist, which makes here the first moment
 * anybody can. Note what forgetting it now IS, with somebody listening: a
 * removal is a `storage` event, so a sibling tab hears the same nothing and
 * lands on the default beside this one. That is the honest end state — the
 * browser keeps no pick any more — rather than two tabs disagreeing about a
 * name neither can paint.
 *
 * The chrome is repainted either way, because the shell could only ship the
 * DEFAULT's paper in a tag it wrote, and the install mark as a file, before
 * anybody's pick was known.
 */
export const followStoredTheme = (): void => {
  const stored = attribute()
  const picked = stored === null ? undefined : paletteNamed(stored)
  if (stored !== null && picked === undefined) writePreference(THEME_STORAGE_KEY, null)
  // The default's block lands on the bare `:root`, so a page that picked
  // nothing is already painted: this only catches the signal and the chrome up
  // with what the sheet is already doing.
  show(picked)

  watchPreference(THEME_STORAGE_KEY, (value) => {
    if (value === null) return show(undefined)
    const next = paletteNamed(value)
    // A name no palette offers is LEFT ALONE, and it is the one case where
    // this tab does nothing: the tab that stored it forgets it there, on its
    // own next load, and repainting this page in a guess meanwhile would put
    // it in a theme nobody picked.
    if (next !== undefined) show(next)
  })
}
