/**
 * Which typeface this browser is in, and what picking one does.
 *
 * The ELEMENT is the state: `<html data-font="inter">` is what the sheet keys
 * off, so the signal here mirrors that attribute rather than owning a second
 * copy of it that could disagree. That matters because the attribute is
 * written before this module exists — the shell's inline boot script puts the
 * stored pick on `<html>` while the document is still parsing (`index.html`),
 * which is the whole reason a reload does not flash Atkinson at somebody who
 * chose Inter. Everything on the page is deferred; a face restored from here
 * would land after the first paint.
 *
 * The wiring is the theme's (`./state.ts`), on purpose: a font is the same
 * kind of preference (written on `<html>` before the bundle runs) and so it
 * cannot ride `createPreference` either. `preference.test.ts` names this file
 * as the second exception for that reason.
 *
 * Nothing about any of this reaches the server: a pick is a preference of this
 * browser's (`../preference.ts`).
 */

import { type Accessor, createSignal } from "solid-js"

import {
  DEFAULT_FONT,
  DEFAULT_TYPEFACE,
  FONT_ATTRIBUTE,
  FONT_STORAGE_KEY,
  type Typeface,
  typefaceNamed,
} from "@olai/fonts"
import { watchPreference, writePreference } from "../preference.ts"

const root = (): HTMLElement => document.documentElement

const attribute = (): string | null => root().getAttribute(FONT_ATTRIBUTE)

const [named, setNamed] = createSignal<string>(DEFAULT_FONT)

/** The typeface in force — never `null`: a page that has picked nothing is in
 *  the default, which is a face like any other and the one the sheet's bare
 *  `:root` paints. It is what the Font row's select shows. */
export const currentFont: Accessor<string> = named

export const currentTypeface = (): Typeface =>
  typefaceNamed(named()) ?? DEFAULT_TYPEFACE

/**
 * Put the page in a typeface: the attribute the sheet keys off, and the signal
 * the picker reads. Two things that have to stay in step, so they are written
 * down once.
 *
 * `undefined` is the page NOBODY HAS PICKED ON, which is not the same fact as a
 * page naming the default: it carries no attribute at all, because the
 * default's block lands on the bare `:root`.
 */
const show = (face: Typeface | undefined): void => {
  if (face === undefined) root().removeAttribute(FONT_ATTRIBUTE)
  else root().setAttribute(FONT_ATTRIBUTE, face.name)
  setNamed((face ?? DEFAULT_TYPEFACE).name)
}

/** Pick a typeface — the whole of what the Font row's select does.
 *
 *  Picking the DEFAULT is a pick like any other and is remembered as one: the
 *  alternative — storing nothing, so that the page falls back — would make
 *  "atkinson" mean two different things, and a later change of default would
 *  silently move everybody who had chosen the old one. */
export const pickFont = (face: Typeface): void => {
  show(face)
  writePreference(FONT_STORAGE_KEY, face.name)
}

/**
 * Take up whatever the boot script left on `<html>`, and FOLLOW the browser's
 * pick for as long as the document lives.
 *
 * Called once, from the client's entry point, for the same reason
 * `followStoredTheme` is: it is a property of the DOCUMENT and lives exactly
 * as long as the document does.
 *
 * A stored value no row offers — a face renamed, a face dropped, an older
 * olai's spelling — is FORGOTTEN on the way in rather than kept: the sheet has
 * no block for it, so a page left holding one would sit on the default's
 * stacks while claiming to be in something else, and no option would be
 * selected. The boot script cannot do this; it is four lines in the shell and
 * deliberately knows nothing about which faces exist.
 */
export const followStoredFont = (): void => {
  const stored = attribute()
  const picked = stored === null ? undefined : typefaceNamed(stored)
  if (stored !== null && picked === undefined) {
    writePreference(FONT_STORAGE_KEY, null)
  }
  show(picked)

  watchPreference(FONT_STORAGE_KEY, (value) => {
    if (value === null) return show(undefined)
    const next = typefaceNamed(value)
    if (next !== undefined) show(next)
  })
}
