/**
 * Whether this browser draws the outlines OLAI NAMED FOR ITSELF.
 *
 * The files under `_olai/` are the ones olai minted because somebody pressed
 * something — the shelf, the trash, and since 2026-08-20 the inbox — and every
 * one of them already has a door of its own in this column: the shelf IS
 * `Pins.olai`'s face, the Trash entry is the trash's, the Inbox entry is the
 * inbox's. Drawn in the file tree as well they are three rows of noise on top
 * of a reader's own outlines, which is the bug this was filed as (human,
 * 2026-08-20, off #282's shots).
 *
 * So the tree stops drawing them, and this switch draws them again — for the
 * person who wants to open `Pins.olai` as an outline and read the addresses in
 * it. Off by default, because the whole point is a quieter column.
 *
 * IT IS A DRAWING RULE AND NOT A SET RULE, which is the line worth keeping
 * sharp: search reaches those files either way, an agent's `list_outlines`
 * lists them either way, the trash page and the shelf read them either way,
 * and nothing here is sent anywhere. What moves is one list of rows in one
 * column of one browser.
 *
 * WHICH FILES those are is `@olai/format`'s (`inOlaiDir`) and not this
 * module's, for the reason every convention in that package is there: a rule
 * about what a served file IS, spelled in two places, is two answers about one
 * directory.
 *
 * The circuit is `../preference.ts`, exactly as the done preference's is, and
 * the cross-tab follow is the same `storage` event the theme and the folds
 * ride, started once from `main.tsx`.
 */

import { inOlaiDir } from "@olai/format"
import type { Accessor } from "solid-js"

import { boolCodec, createPreference } from "../preference.ts"

export const HIDDEN_OUTLINES_KEY = "olai.outlines.hidden"

/** Hidden, for a browser that has never been asked — and for a value nothing
 *  here ever wrote, which is `boolCodec`'s rule and not this file's. */
const HIDDEN = true

/** The circuit (../preference.ts); the codec is the whole of this file's say
 *  in how it is stored. */
const pref = createPreference(HIDDEN_OUTLINES_KEY, boolCodec(HIDDEN))

/** Whether this browser keeps olai's own outlines out of the file tree. */
export const outlinesHidden: Accessor<boolean> = pref.value

/** Pick one — `pref.set` writes `olai.outlines.hidden`. */
export const setOutlinesHidden = (value: boolean): void => pref.set(value)

/**
 * Whether the file tree draws `file`.
 *
 * The preference and what it DOES to a list of paths are one thing, said once
 * here rather than as a condition spelled at the tree — the shape
 * `./done.ts`'s `visible` has, and for its reason: what "hidden" means is a
 * fact about the preference, and a second site deciding it is a second answer.
 *
 * It is asked per PATH rather than handed the list, because the sidebar
 * already filters that list for the trash (an archive is not an outline a
 * reader opens, whichever way this switch is set — `Sidebar.tsx`), and two
 * filters over one array is one pass either way.
 */
export const drawnInTree = (file: string): boolean =>
  !outlinesHidden() || !inOlaiDir(file)

/** Follow it for as long as this document lives — the shape every stored
 *  preference has, started once from `main.tsx`, because a preference belongs
 *  to the browser and a browser is more than one tab. */
export const followOutlinesHidden = (): void => {
  pref.follow()
}
