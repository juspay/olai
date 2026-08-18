/**
 * Whether this browser edits markdown in vim.
 *
 * A claim about the READER — "my hands know hjkl" — so it lives here with the
 * other preferences rather than as a control on an editor, and it is OFF for a
 * browser that has never been asked. A person who does not know vim must not
 * be able to arrive in normal mode by accident: an editor that swallows every
 * letter you type is indistinguishable from a broken one.
 *
 * It reaches BOTH markdown editors, because they are one editor at two sizes
 * (`../mde/`), and it reaches nothing else: a title is one line in an
 * `<input>`, and vim over a single-line field is a mode nobody asked for.
 *
 * The circuit is `../preference.ts`, the codec is `boolCodec`, and cross-tab
 * follow is the same `storage` event the theme and the folds ride, started
 * once from `main.tsx`.
 *
 * ONE KEY IS THE WHOLE OF WHAT THIS COSTS ELSEWHERE, and it is said in
 * `../keys.ts` rather than here: inside a vim editor `Escape` is the mode
 * switch, so the app does not claim it. That is a fact about the keyboard map,
 * and the map is one file.
 */

import type { Accessor } from "solid-js"

import type { EditField } from "../keys.ts"
import { boolCodec, createPreference } from "../preference.ts"

export const EDITOR_VIM_KEY = "olai.editor.vim"

/** Off, for a browser that has never been asked — and for a value nothing here
 *  ever wrote, which is `boolCodec`'s rule and not this file's. */
const OFF = false

const pref = createPreference(EDITOR_VIM_KEY, boolCodec(OFF))

/** Whether the markdown editors are vim editors in this browser. */
export const vimEditing: Accessor<boolean> = pref.value

/**
 * ...and whether the field a key was pressed in is one of them.
 *
 * The rule and the preference belong together, which is why this is here and
 * not in the keyboard adapter that asks it: "vim is for PROSE" is a fact about
 * what this preference means, and an adapter that spelled `field !== "line" &&
 * vimEditing()` for itself would be the second place to change on the day a
 * title becomes a markdown editor too (`../edit/RowEditor.tsx` contemplates
 * exactly that). The editors in `../mde/` need no such test: they ARE prose
 * editors, by construction and by their own header.
 */
export const vimIn = (field: EditField): boolean => field !== "line" && vimEditing()

/** Persist on change — `pref.set` writes `olai.editor.vim`. */
export const setVimEditing = (value: boolean): void => pref.set(value)

/** Follow it for as long as this document lives — the same shape as
 *  `followDoneHidden` beside it, started once from `main.tsx`, because a
 *  preference belongs to the browser and a browser is more than one tab. */
export const followVimEditing = (): void => {
  pref.follow()
}
