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
 * The paths the file tree actually draws — the whole rule, over the whole
 * list.
 *
 * A LIST in and a list out, which is `./done.ts`'s `visible` one subject over
 * and the same argument: the preference and what it DOES are one thing, so
 * every site that draws a directory asks the same question rather than each
 * spelling a condition of its own. The same array comes back when nothing is
 * hidden, identity and all.
 *
 * ## …EXCEPT A FILE THAT COULD NOT BE READ
 *
 * A ⚠ on its row is the ONLY place this app says an outline failed to parse
 * outside the page you would have to open to find out (`errors/Broken.tsx`,
 * `Sidebar.tsx`). So hiding a broken `_olai/Pins.olai` would swallow that
 * report entirely: the shelf would simply be empty, and nothing anywhere would
 * say why — the silent failure HACKING.md rules out. The row comes back for
 * exactly as long as the file will not parse, and goes when it does.
 *
 * WHICH files could not be read is the caller's, because it is a fact about
 * the SET rather than about this preference: the sidebar already holds the
 * map, and a second reading of it here would be a second answer. It is that
 * MAP rather than a set of paths for the same reason — it is the value the
 * directory already publishes (`../directory.ts`) — and its values are
 * `unknown` here because only `has` is ever asked: what a file is wrong about
 * is the pane's business, not this rule's.
 */
export const drawnInTree = (
  files: ReadonlyArray<string>,
  broken: ReadonlyMap<string, unknown>,
): ReadonlyArray<string> => drawnWhen(files, broken, outlinesHidden())

/** The rule itself, with the preference passed IN — so what it decides is a
 *  unit test over three literals rather than a browser with a `localStorage`
 *  in it. {@link drawnInTree} is this function and the signal, and nothing
 *  else. */
export const drawnWhen = (
  files: ReadonlyArray<string>,
  broken: ReadonlyMap<string, unknown>,
  hiding: boolean,
): ReadonlyArray<string> =>
  hiding
    ? files.filter((file) => !inOlaiDir(file) || broken.has(file))
    : files

/** Follow it for as long as this document lives — the shape every stored
 *  preference has, started once from `main.tsx`, because a preference belongs
 *  to the browser and a browser is more than one tab. */
export const followOutlinesHidden = (): void => {
  pref.follow()
}
