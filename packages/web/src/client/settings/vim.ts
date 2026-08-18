/**
 * Whether this browser edits markdown in vim.
 *
 * A claim about the READER — "my hands know hjkl" — so it lives here with the
 * other preferences rather than as a control on an editor, and it is OFF for a
 * browser that has never been asked. A person who does not know vim must not
 * be able to arrive in normal mode by accident: an editor that swallows every
 * letter you type is indistinguishable from a broken one.
 *
 * It reaches the markdown editor a DOCUMENT is written in (`../mde/`), which
 * is the one surface this app draws with it, and nothing else: a title is one
 * line in an `<input>`, and a note is the textarea it has always been (its own
 * item, later).
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
import { editorReady } from "../mde/chunk.ts"
import { boolCodec, createPreference } from "../preference.ts"

export const EDITOR_VIM_KEY = "olai.editor.vim"

/** Off, for a browser that has never been asked — and for a value nothing here
 *  ever wrote, which is `boolCodec`'s rule and not this file's. */
const OFF = false

const pref = createPreference(EDITOR_VIM_KEY, boolCodec(OFF))

/** Whether the markdown editors are vim editors in this browser. */
export const vimEditing: Accessor<boolean> = pref.value

/**
 * ...and whether the key that was just pressed is in a vim editor — which is
 * three questions, not one.
 *
 * IT IS THE FIELD THIS EDITOR DRAWS. "Vim is for the markdown editor" is a
 * fact about what this preference means, so it is stated here rather than in
 * the keyboard adapter that asks — an adapter spelling the field test for
 * itself would be the second place to change on the day a NOTE becomes this
 * editor too.
 *
 * THE READER ASKED FOR IT. The preference.
 *
 * AND THERE IS ACTUALLY A VIM EDITOR THERE — which is the one a preference
 * alone cannot answer. Until CodeMirror's chunk lands, and forever if it never
 * does, a person types into the TEXTAREA (`../mde/Mde.tsx`), and a textarea is
 * not a vim editor: nothing in it will answer `Escape`. Reported as `HELD` on
 * that face, the key would be spent on nobody — the draft not cancelled, the
 * dismissal never reached, and a document left with no keyboard way out at all
 * (its Escape is the door `HELD` skipped). So the answer is false until the
 * face that can honour it exists.
 *
 * The order of the three matters: a TITLE never reaches the chunk question, so
 * typing in one cannot start a fetch nobody asked for.
 */
export const vimIn = (field: EditField): boolean =>
  field === "doc" && vimEditing() && editorReady()

/** Persist on change — `pref.set` writes `olai.editor.vim`. */
export const setVimEditing = (value: boolean): void => pref.set(value)

/** Follow it for as long as this document lives — the same shape as
 *  `followDoneHidden` beside it, started once from `main.tsx`, because a
 *  preference belongs to the browser and a browser is more than one tab. */
export const followVimEditing = (): void => {
  pref.follow()
}
