/**
 * What size this browser reads at, and what picking one does.
 *
 * The ELEMENT is the state: `<html data-size="larger">` is what the sheet keys
 * off, so the signal here mirrors that attribute rather than owning a second
 * copy of it that could disagree. That matters because the attribute is written
 * before this module exists — the shell's inline boot script puts the stored
 * pick on `<html>` while the document is still parsing (`index.html`) — and a
 * size restored after the first paint would REFLOW the whole page under
 * somebody who had just opened it, which is the loudest of the three flashes
 * this arrangement exists to prevent.
 *
 * The wiring is the theme's and the typeface's (`./state.ts`, `./fontState.ts`),
 * on purpose: it is the same kind of preference, written on `<html>` before the
 * bundle runs, so it cannot ride `createPreference` either. `preference.test.ts`
 * names this file as the third exception for that reason.
 *
 * Nothing about any of this reaches the server: a pick is a preference of this
 * browser's (`../preference.ts`).
 */

import { type Accessor, createSignal } from "solid-js"

import { watchPreference, writePreference } from "../preference.ts"
import {
  DEFAULT_SIZE,
  DEFAULT_TYPE_SIZE,
  SIZE_ATTRIBUTE,
  SIZE_STORAGE_KEY,
  sizeNamed,
  type TypeSize,
} from "./sizes.ts"

const root = (): HTMLElement => document.documentElement

const attribute = (): string | null => root().getAttribute(SIZE_ATTRIBUTE)

const [named, setNamed] = createSignal<string>(DEFAULT_SIZE)

/** The size in force — never `null`: a page that has picked nothing is in the
 *  default, which is a size like any other and the one the sheet's bare `:root`
 *  sets. It is what the Size row's segments are drawn against. */
export const currentSize: Accessor<string> = named

export const currentTypeSize = (): TypeSize =>
  sizeNamed(named()) ?? DEFAULT_TYPE_SIZE

/**
 * Put the page at a size: the attribute the sheet keys off, and the signal the
 * picker reads. Two things that have to stay in step, so they are written down
 * once.
 *
 * `undefined` is the page NOBODY HAS PICKED ON, which is not the same fact as a
 * page naming the default: it carries no attribute at all, because the default's
 * block lands on the bare `:root`.
 */
const show = (size: TypeSize | undefined): void => {
  if (size === undefined) root().removeAttribute(SIZE_ATTRIBUTE)
  else root().setAttribute(SIZE_ATTRIBUTE, size.name)
  setNamed((size ?? DEFAULT_TYPE_SIZE).name)
}

/** Pick a size — the whole of what the Size row does.
 *
 *  Picking the DEFAULT is a pick like any other and is remembered as one: the
 *  alternative — storing nothing, so that the page falls back — would make
 *  "large" mean two different things, and a later change of default would
 *  silently move everybody who had chosen the old one. */
export const pickSize = (size: TypeSize): void => {
  show(size)
  writePreference(SIZE_STORAGE_KEY, size.name)
}

/**
 * Take up whatever the boot script left on `<html>`, and FOLLOW the browser's
 * pick for as long as the document lives.
 *
 * Called once, from the client's entry point, for the same reason
 * `followStoredFont` is: it is a property of the DOCUMENT and lives exactly as
 * long as the document does.
 *
 * A stored value no row offers — an older olai's spelling, something typed into
 * a console — is FORGOTTEN on the way in rather than kept: the sheet has no
 * block for it, so a page left holding one would sit at the default's size while
 * claiming to be at another, and no segment would be pressed. The boot script
 * cannot do this; it is four lines in the shell and deliberately knows nothing
 * about which sizes exist.
 */
export const followStoredSize = (): void => {
  const stored = attribute()
  const picked = stored === null ? undefined : sizeNamed(stored)
  if (stored !== null && picked === undefined) {
    writePreference(SIZE_STORAGE_KEY, null)
  }
  show(picked)

  watchPreference(SIZE_STORAGE_KEY, (value) => {
    if (value === null) return show(undefined)
    const next = sizeNamed(value)
    if (next !== undefined) show(next)
  })
}
