/**
 * The caret: a title being typed, a note being written, and the reason the
 * last one would not save.
 *
 * **An `<input>`, not a `contenteditable`** — the one design choice in this
 * file, and it follows from what a title IS. A title is one verbatim line of
 * text in a JSON record; it has no markup, no spans and no structure. A
 * `contenteditable` is an HTML document you keep in sync with a string, and it
 * would buy exactly one thing here: `#tags` staying painted while the caret is
 * inside them. What it would cost is the rest of the file — an innerHTML this
 * app writes rather than sanitises, a caret that jumps when a live frame
 * re-renders the row underneath it, and paste arriving as somebody else's
 * markup. An input is one string in and one string out, and it gives us the
 * platform's own caret, selection, undo, IME and autofill for nothing.
 *
 * The trade is visible and deliberate: WHILE YOU TYPE, a title reads as the
 * text on disk, tags and all, and the styled tags come back the moment you
 * leave. That is honest — what is on screen is what the file will say — and it
 * is the same trade the note takes, where a textarea shows markdown and the
 * rendering returns on blur.
 *
 * Styled to be invisible: the same font, size, weight and colour as the title
 * it replaces, no border, no background, no ring. A row must not jump when it
 * becomes editable, so the input's box is the title span's box — which is why
 * it is `w-full` inside the same flex cell rather than a control with padding
 * of its own.
 */



import { createEffect, on } from "solid-js"

import { type EditAction, type EditField, editKey } from "../keys.ts"
import { TESTID } from "../testids.ts"
import type { OpFailure } from "@olai/surface"

/** What the title span and the input that replaces it must agree about, so a
 *  row does not shift by a pixel when the caret arrives (../NodeLine.tsx uses
 *  the same two utilities). */
const AS_TITLE = "text-[0.9375rem] leading-snug"

export function TitleEditor(props: {
  readonly text: string
  /** Bumped whenever the caret has to be put back — see {@link takeCaret}. */
  readonly caret: number
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: () => void
  /** A new row that does not exist yet: it says so, so an empty line in the
   *  middle of a tree is not a mystery. */
  readonly placeholder?: string
}) {
  let element!: HTMLInputElement
  takeCaret(() => props.caret, () => {
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
  })

  return (
    <input
      ref={element}
      type="text"
      class={`w-full flex-1 border-0 bg-transparent p-0 text-ink outline-none ${AS_TITLE}`}
      data-testid={TESTID.titleEditor}
      value={props.text}
      placeholder={props.placeholder}
      autocomplete="off"
      spellcheck={false}
      onInput={(event) => props.onInput(event.currentTarget.value)}
      onKeyDown={(event) => props.onKey(event)}
      onBlur={() => props.onBlur()}
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
  readonly caret: number
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: () => void
}) {
  let element!: HTMLTextAreaElement
  takeCaret(() => props.caret, () => {
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
    grow(element)
  })

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
      onBlur={() => props.onBlur()}
    />
  )
}

/** What the write said no to, under the row it was typed in. The draft is
 *  still there and still holds the text — this is the other half of that
 *  promise, because a refusal nobody can see is a keystroke that vanished. */
export function Refused(props: { readonly failure: OpFailure }) {
  return (
    <p
      class="mt-0.5 mb-1 text-[0.8125rem] leading-snug text-alarm"
      data-testid={TESTID.editRefusal}
      data-kind={props.failure._tag}
      role="alert"
    >
      {props.failure.message}
    </p>
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
 */
const takeCaret = (caret: () => number, take: () => void): void => {
  createEffect(on(caret, take))
}

/** A textarea that is as tall as what is in it. */
const grow = (element: HTMLTextAreaElement): void => {
  element.style.height = "auto"
  element.style.height = `${element.scrollHeight}px`
}

