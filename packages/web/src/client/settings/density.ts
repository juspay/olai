/**
 * How much of a row this browser wants to see by default.
 *
 * A claim about the READER and not about any one outline — "I read a tree as a
 * list of titles" / "I want the first line of every note" / "show me everything"
 * — so it lives here beside the done preference, is stored in this browser, and
 * reaches the server never. Three answers, and each is a DEFAULT rather than a
 * lock: a row still opens and shuts under the pointer at every one of them, and
 * what the switch decides is only where an untouched row starts
 * (`../note/expand.ts` is where those two meet).
 *
 *   - `compact` — a row is its title. A node carrying a note says so with the
 *     pilcrow beside it (`../note/Mark.tsx`) and nothing else; this is the
 *     default, and it is the whole point of the quiet outline.
 *   - `cozy` — the title, and one dim clamped line of the note under it. The
 *     shape every row had before this preference existed.
 *   - `open` — every row starts OPEN: title, properties run, note in full. The
 *     always-shown note, kept, for a reader who was never asking for less.
 *
 * The circuit is `../preference.ts`, exactly as the done preference's is, and
 * the cross-tab follow is the same `storage` event the theme and the folds ride,
 * started once from `main.tsx`.
 */

import type { Accessor } from "solid-js"

import { createPreference, type PreferenceCodec } from "../preference.ts"

export const DENSITY_KEY = "olai.notes.density"

/** The three answers, as a closed set — a typo is a compile error rather than a
 *  stored word nothing draws. */
export type Density = "compact" | "cozy" | "open"

/** What a browser that has never been asked reads: the title alone. The
 *  decluttering ruling is that a tree is a list of titles until somebody asks
 *  it for more (human, the quiet outline). */
export const DEFAULT_DENSITY: Density = "compact"

const DENSITIES: ReadonlyArray<Density> = ["compact", "cozy", "open"]

/** The whole of this file's say in how it is stored. A word this app did not
 *  write — an older olai, something typed into a console — is the default
 *  rather than an error, which is `../preference.ts`'s rule for every key; the
 *  default PRINTS as itself rather than as `null`, because "compact" is a pick
 *  a reader may have made on purpose after trying the other two. */
const codec: PreferenceCodec<Density> = {
  parse: (raw) =>
    DENSITIES.find((one) => one === raw) ?? DEFAULT_DENSITY,
  print: (value) => value,
}

const pref = createPreference(DENSITY_KEY, codec)

/** How this browser reads a row by default. */
export const density: Accessor<Density> = pref.value

/** Pick one — `pref.set` writes `olai.notes.density`. */
export const setDensity = (value: Density): void => pref.set(value)

/** Does a CLOSED row draw the clamped one-line preview under its title? True at
 *  `cozy` and nowhere else: `compact` says the title alone and `open` is not
 *  closed. Asked here rather than compared at each drawing site, so the two
 *  surfaces that draw a note cannot answer it differently. */
export const showsPreview = (value: Density): boolean => value === "cozy"

/** Does an UNTOUCHED row start open? The other half of the same table. */
export const startsOpen = (value: Density): boolean => value === "open"

/** Follow it for as long as this document lives — the shape every stored
 *  preference has, started once from `main.tsx`, because a preference belongs
 *  to the browser and a browser is more than one tab. */
export const followDensity = (): void => {
  pref.follow()
}
