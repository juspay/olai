/**
 * The DOM half of the keyboard map: read a keystroke against `./keys.ts`, and
 * let the field have whatever the map does not claim.
 *
 * TWO FILES BECAUSE THERE ARE TWO JOBS, and the split is what keeps the first
 * one testable: `./keys.ts` decides what a key MEANS and is pure of the DOM
 * beyond the event, so every layer of it is unit-tested with no browser; this
 * is the adapter that reads an element, asks that question, and spends the
 * event — `preventDefault` so the browser does not also act, `stopPropagation`
 * so the window listeners (the palette, the panels that shut on Escape) do not
 * hear a key the editor answered.
 *
 * IT IS THE ONE PLACE THE CARET IS READ OFF THE DOM, which is the whole reason
 * {@link Caret} is a value: two keys mean different things depending on where
 * in the line they were pressed (`Enter` splits mid-text, `Backspace` merges at
 * offset zero), and everything on either side of this function is testable
 * because neither of them touches an element.
 *
 * It lives at the top level rather than in `edit/` because THREE surfaces ask
 * it and only two of them are rows: a row's title and note (`edit/`), the line
 * a page offers where an outline has none (`edit/StartLine.tsx`), and a whole
 * document (`document/DocEditor.tsx`). It was `edit/RowEditor.tsx`'s export
 * until the document editor needed it, which made a page import a ROW's
 * component module for a function about keys.
 */

import { type Caret, type EditAction, type EditField, editKey, HELD } from "./keys.ts"
import { vimIn } from "./settings/vim.ts"

/**
 * WHETHER THIS IS A VIM EDITOR is asked of the preference that owns the rule
 * (`./settings/vim.ts`) and handed to the map, which is what decides `Escape`.
 * Asked inside the handler rather than closed over, so a person who turns the
 * preference on while an editor is open gets the answer the editor beside them
 * already has.
 *
 * THREE ANSWERS, and the middle one is why the map returns a value for it: the
 * app's (spend the event and press it), the EDITOR'S (stop it here — see
 * `./keys.ts`'s `HELD`), and nobody's (leave it alone and let it travel).
 */
export const keyHandler = (
  field: EditField,
  press: (action: EditAction, at?: Caret) => void,
) =>
(event: KeyboardEvent): void => {
  // Not in PROSE, where the matcher answers before it would ever look
  // (./keys.ts: prose is not a row, and the keys that edit a row are the
  // row's). Reading it anyway would materialise the whole editor's value per
  // keystroke to take its length — on the fields that can be long.
  const at = field === "line" ? caretOf(event.currentTarget) : undefined
  const action = editKey(event, field, at, vimIn(field))
  if (action === null) return
  // The editor's own: it stops here rather than travelling on, because what it
  // would reach is the listener that shuts the panels this client draws
  // (`./dismiss.ts`).
  if (action === HELD) {
    event.stopPropagation()
    return
  }
  event.preventDefault()
  // Stop it there: the palette listens on the window, and an outline key that
  // also reached a global handler would be one keystroke doing two things.
  event.stopPropagation()
  press(action, at)
}

/** The selection in the field a key was pressed in, or `undefined` for anything
 *  that is not one — which is not a case an editor reaches, and is answered
 *  rather than asserted because a handler that threw would take a keystroke
 *  down with it. */
const caretOf = (target: EventTarget | null): Caret | undefined => {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
    return undefined
  }
  const { selectionStart, selectionEnd, value } = target
  if (selectionStart === null || selectionEnd === null) return undefined
  return { start: selectionStart, end: selectionEnd, text: value }
}
