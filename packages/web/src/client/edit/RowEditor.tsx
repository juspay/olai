/**
 * The caret: a title being typed, a note being written, and what the last
 * write said back.
 *
 * **An `<input>`, not a `contenteditable`** — the one design choice in this
 * file, and it follows from what a title IS. A title is one verbatim line of
 * text in a JSON record. What the page DRAWS is a rendering of it — inline
 * markdown and `#tags`, sanitised at view time (`../markdown/title.ts`) — and
 * that is the argument for an input rather than against it: a
 * `contenteditable` would be that rendered HTML, made editable, and every
 * keystroke would have to be turned back into the one string the record
 * actually holds. What it would cost is the rest of the file — an innerHTML
 * this app writes rather than sanitises, a caret that jumps when a live frame
 * re-renders the row underneath it, and paste arriving as somebody else's
 * markup. An input is one string in and one string out, and it gives us the
 * platform's own caret, selection, undo, IME and autofill for nothing.
 *
 * The trade is visible and deliberate: WHILE YOU TYPE, a title reads as its
 * SOURCE — `**bold**` and `#tags` as they are written — and the rendering
 * comes back the moment you leave. That is honest, it is what the file will
 * say, and it is exactly the trade the note takes one level down, where a
 * textarea shows markdown until it closes.
 *
 * Styled to be invisible: the same font, size, weight and colour as the title
 * it replaces, no border, no background, no ring. A row must not jump when it
 * becomes editable, so the input's box is the title span's box — which is why
 * it is `w-full` inside the same flex cell rather than a control with padding
 * of its own.
 *
 * {@link Said} is drawn wherever an editor is, and that is why it lives here
 * rather than in the tree: a refusal must be visible for EVERY draft, and two
 * of the places a draft can be — a new row on an empty outline, a row whose
 * parent is folded — are places the tree draws no body under.
 */

import { createEffect, on, Show } from "solid-js"

import type { Draft } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { type EditAction, type EditField, editKey } from "../keys.ts"
import { TESTID } from "../testids.ts"
import { ROW_TITLE } from "../touch.ts"

export function TitleEditor(props: {
  readonly text: string
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  /** `left` is whether the caret went somewhere else, rather than the element
   *  being taken out of the document by a re-render — see `Editor.blur`. */
  readonly onBlur: (left: boolean) => void
  /** A new row that does not exist yet: it says so, so an empty line in the
   *  middle of a tree is not a mystery. */
  readonly placeholder?: string
}) {
  let element!: HTMLInputElement
  takeCaret(() => element)

  return (
    <input
      ref={element}
      type="text"
      class={`w-full flex-1 border-0 bg-transparent p-0 text-ink outline-none ${ROW_TITLE}`}
      data-testid={TESTID.titleEditor}
      value={props.text}
      placeholder={props.placeholder}
      autocomplete="off"
      spellcheck={false}
      onInput={(event) => props.onInput(event.currentTarget.value)}
      onKeyDown={(event) => props.onKey(event)}
      onBlur={() => props.onBlur(element.isConnected)}
    />
  )
}

/**
 * The note, as the text it is.
 *
 * A `desc` is one verbatim markdown string, so a textarea is the honest
 * editor: what is typed is what is stored, and the rendering comes back when
 * it closes. It grows with its content because a note is usually two lines and
 * occasionally twenty, and a fixed box would be wrong for both.
 */
export function DescEditor(props: {
  readonly text: string
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
}) {
  let element!: HTMLTextAreaElement
  takeCaret(() => element, () => grow(element))

  return (
    <textarea
      ref={element}
      class="mt-0.5 mb-1 block w-full resize-none rounded border border-rule bg-paper px-1.5 py-1 font-mono text-[0.8125rem] leading-snug text-ink outline-none focus:border-accent"
      data-testid={TESTID.descEditor}
      rows={2}
      value={props.text}
      onInput={(event) => {
        grow(event.currentTarget)
        props.onInput(event.currentTarget.value)
      }}
      onKeyDown={(event) => props.onKey(event)}
      onBlur={() => props.onBlur(element.isConnected)}
    />
  )
}

/**
 * What the last write said, under the editor it was typed in.
 *
 * Two moods, one line, because they are two halves of one question — did that
 * land, and is there anything to know about it:
 *
 *   - a REFUSAL, which is why the text is still here. The draft holds it and
 *     the reason is beside it, because a refusal nobody can see is a keystroke
 *     that vanished.
 *   - a NUDGE, which is the opposite: the write landed, and the rollup noticed
 *     something a person usually wants noticed (the last task under a parent
 *     going done, a branch ticked over unfinished ones). Advice, never a
 *     reason anything failed — so it is toned like a note rather than an
 *     alarm, and the next keystroke takes it away.
 */
export function Said(props: { readonly draft: Draft }) {
  return (
    <>
      <Show when={props.draft.refused}>
        {(failure) => (
          <p
            class="mt-0.5 mb-1 text-[0.8125rem] leading-snug text-alarm"
            data-testid={TESTID.editRefusal}
            data-kind={failure()._tag}
            role="alert"
          >
            {failure().message}
          </p>
        )}
      </Show>
      <Show when={props.draft.nudge}>
        {(nudge) => (
          <p
            class="mt-0.5 mb-1 text-[0.8125rem] leading-snug text-muted"
            data-testid={TESTID.editNudge}
          >
            {nudge()}
          </p>
        )}
      </Show>
    </>
  )
}

/** The key handler a row's editor wants: read the key against the map, and let
 *  the field have anything the map does not claim. Here rather than in each
 *  component because "which keys are the editor's" is one question with one
 *  answer (../keys.ts) and two copies of the `preventDefault` would be two
 *  chances to leave `Tab` moving focus out of the outline. */
export const keyHandler = (
  field: EditField,
  press: (action: EditAction) => void,
) =>
(event: KeyboardEvent): void => {
  const action = editKey(event, field)
  if (action === null) return
  event.preventDefault()
  // Stop it there: the palette listens on the window, and an outline key that
  // also reached a global handler would be one keystroke doing two things.
  event.stopPropagation()
  press(action)
}

/**
 * Take the caret when the editor opens, and take it BACK whenever the editor
 * says to.
 *
 * The second half is not belt and braces. A structural key redraws the row it
 * was pressed in — an indent gives it a new place and a whole new branch, a
 * reorder moves its element among its siblings — and moving or replacing a
 * focused element in the document takes the focus off it. So a person who
 * presses `Tab` and then types would be typing into the page. The editor
 * bumps a counter after every op that can do that (`Editor.caret`), and this
 * is what listens: one number, one effect, and no polling of
 * `document.activeElement`.
 *
 * The counter is read from the EDITOR rather than passed in: every one of
 * these is drawn inside the provider by construction, and a magic number
 * threaded through three components is a prop the next editor site forgets.
 *
 * WHERE the caret lands differs between the two halves, and that is what
 * `opening` is for: a fresh editor puts it at the end of the text, which is
 * where a person who just clicked a title wants it; a caret being taken BACK
 * goes where it already was, so `Tab` in the middle of a word does not throw
 * the reader to the end of the line.
 */
const takeCaret = (
  element: () => HTMLInputElement | HTMLTextAreaElement,
  also?: () => void,
): void => {
  const editor = useEditor()
  let opening = true
  createEffect(on(editor.caret, () => {
    const field = element()
    const at = opening ? field.value.length : field.selectionStart ?? field.value.length
    opening = false
    field.focus()
    field.setSelectionRange(at, at)
    also?.()
  }))
}

/**
 * A textarea that is as tall as what is in it.
 *
 * Measuring costs a synchronous layout — `height: auto` invalidates, reading
 * `scrollHeight` forces the recompute — and that is per keystroke in an open
 * NOTE. It is paid rather than optimised away: a guard comparing the height
 * after setting `auto` never skips anything (the value it compares against is
 * `auto`), which is what the last attempt did, and the honest alternatives are
 * to remember the last height across calls or to let CSS do it
 * (`field-sizing: content`, not yet everywhere olai runs). One note at a time
 * is open, so the cost is bounded by that.
 */
const grow = (element: HTMLTextAreaElement): void => {
  element.style.height = "auto"
  element.style.height = `${element.scrollHeight}px`
}
