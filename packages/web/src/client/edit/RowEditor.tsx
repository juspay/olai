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
 * comes back the moment you leave. That is honest, and it is what the file
 * will say.
 *
 * THE NOTE ONE LEVEL DOWN NO LONGER TAKES THAT TRADE, and the difference
 * between the two is a difference in size rather than in doctrine. A title is
 * one line and its rendering is inline phrasing; a note is prose, where
 * markers are most of what is on the screen, so it is live-previewed
 * (`../mde/`) — the source is still the model, still verbatim, and what
 * changes is only that the `**` hides while the caret is elsewhere. The same
 * thing could be done to a title one day and it would be the same editor; it
 * is not done today because the argument above (one string in, one string out,
 * and the platform's own caret) is worth more on a field that holds one line.
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

import { createEffect, createSignal, on, Show } from "solid-js"

import { createCompletion } from "../complete/completing.tsx"
import type { Draft } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { type Caret, type EditAction, type EditField, editKey, heldByVim } from "../keys.ts"
import { Mde } from "../mde/Mde.tsx"
import { SaidLine } from "./SaidLine.tsx"
import { vimEditing } from "../settings/vim.ts"
import { TESTID } from "../testids.ts"
import { ROW_NOTE as AS_NOTE, ROW_TITLE } from "../touch.ts"

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
  /** Where the caret goes when this editor OPENS, when the draft has an
   *  opinion — which is only ever after a split or a merge, where the whole
   *  point of the key is that the caret stays in the sentence. Absent is the
   *  end of the text, which is what a click on a title means. */
  readonly caret?: number
}) {
  let element!: HTMLInputElement

  /**
   * WHERE the caret is, as a signal — the one fact the input widgets need that
   * a draft does not carry.
   *
   * It is read off the element rather than tracked alongside it, because the
   * caret moves for reasons no handler here sees: a click in the middle of a
   * word, `Home`, a drag-selection, an IME. So every event that could have
   * moved it re-reads it, and the value is the element's own answer rather than
   * this component's arithmetic about what the last key should have done.
   *
   * WHICH MAKES THE ELEMENT THE ONE AUTHORITY, and everything that moves the
   * caret has to tell this — including the two things in this file that move it
   * themselves: {@link takeCaret}, which puts the caret back after a write
   * redrew the row (hence the `then` below), and the completion's `rewrite`. A
   * signal that only tracked EVENTS would go stale exactly when a widget was
   * about to be armed from it.
   */
  const [caret, setCaret] = createSignal(0)
  const readCaret = (): void => {
    setCaret(element.selectionStart ?? 0)
  }

  takeCaret(() => element, { at: () => props.caret, then: readCaret })

  /** The three widgets, as one loop ({@link ../complete/completing.tsx}) — one
   *  hook, whose two members are the two jobs a field with a completion in it
   *  has: offer it the keys, and draw it. The rewrite is the DOM half: the
   *  field's value and its caret are set here, where the element is, and the
   *  draft is told in the same breath so the two cannot disagree about what the
   *  line says. */
  const editor = useEditor()
  const completion = createCompletion({
    text: () => props.text,
    caret,
    rewrite: (next) => {
      element.value = next.text
      element.setSelectionRange(next.caret, next.caret)
      setCaret(next.caret)
      props.onInput(next.text)
    },
    // The two OPS a completion can cause, handed DOWN rather than reached for
    // — this is where the editor is, and `complete/` stays a primitive that
    // knows nothing about a draft.
    dated: (day) => editor.dated(day),
    mirrored: (target) => editor.mirrored(target),
  })

  return (
    // `relative`, and the input keeps the cell it always had: the popup
    // measures this box and portals out of it, so the row's own geometry is
    // untouched (../complete/Completions.tsx says why it is not in flow).
    <span class="relative flex min-w-0 flex-1">
      <input
        ref={element}
        type="text"
        class={`w-full flex-1 border-0 bg-transparent p-0 text-ink outline-none ${ROW_TITLE}`}
        data-testid={TESTID.titleEditor}
        value={props.text}
        placeholder={props.placeholder}
        autocomplete="off"
        spellcheck={false}
        onInput={(event) => {
          readCaret()
          props.onInput(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          // The widget gets first refusal, and only over the keys it has an
          // answer for — see `Completion.key`. What it takes, it takes whole:
          // an arrow that walked the list must not also walk the outline.
          if (completion.key(event)) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          props.onKey(event)
          // AFTER the row's own handler, so a key that moved the caret has
          // moved it: `queueMicrotask` is one turn later, which is when the
          // field's selection reflects the press.
          queueMicrotask(readCaret)
        }}
        onClick={readCaret}
        onSelect={readCaret}
        onFocus={readCaret}
        onBlur={() => props.onBlur(element.isConnected)}
      />
      <completion.Panel />
    </span>
  )
}

/**
 * The note, as the markdown it is.
 *
 * A `desc` is one verbatim markdown string, and this is where that string is
 * typed — LIVE-PREVIEWED since md-live-preview-editor, which changes what the
 * caret sees and nothing at all about what is stored: `**bold**` is bold with
 * its markers hidden until you stand in the word, and the file holds the six
 * characters it always held (`../mde/codemirror.ts` argues why there is no
 * serializer in the middle).
 *
 * INLINE, and styled as the note rather than as a control (human, on sight of
 * the first shape: a monospace box under the row is ugly, and it is also a
 * lie — it says "form field" where the page says "the note"). Same size, same
 * muted tone, same place, no border and no background. The box is spelled here
 * and worn by BOTH of the editor's faces (`../mde/Mde.tsx`: the textarea while
 * the chunk is in the air, CodeMirror after it lands), so a note does not move
 * on the page when the one replaces the other.
 *
 * It grows with its content because a note is usually two lines and
 * occasionally twenty, and a fixed box would be wrong for both.
 */
export function DescEditor(props: {
  readonly text: string
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
}) {
  // The counter the open editor watches — read from the EDITOR rather than
  // passed in, for the reason {@link takeCaret} gives: every one of these is
  // drawn inside the provider by construction.
  const editor = useEditor()

  return (
    <Mde
      text={props.text}
      onInput={props.onInput}
      onKey={props.onKey}
      onBlur={props.onBlur}
      // `olai-md olai-md-compact` is not decoration: it is where the markdown
      // type and spacing scale is declared (`../theme/scale.ts`), so a heading
      // being typed is the size the heading will be, in the density a note is
      // drawn at. The editor's own theme reads those same properties and
      // spells no size of its own (`../mde/theme.ts`).
      class={`mt-0.5 mb-1 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none olai-md olai-md-compact ${AS_NOTE}`}
      testid={TESTID.descEditor}
      take={editor.caret}
      grows
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
          <SaidLine
            said={{ tone: "alarm", text: failure().message }}
            class={SAID_BOX}
            testid={TESTID.editRefusal}
          />
        )}
      </Show>
      <Show when={props.draft.nudge}>
        {(nudge) => (
          <SaidLine
            said={{ tone: "aside", text: nudge() }}
            class={SAID_BOX}
            testid={TESTID.editNudge}
          />
        )}
      </Show>
    </>
  )
}

/** Where a said line sits under a row's editor — the caller's half of
 *  {@link SaidLine}, which owns the mood and not the layout. */
const SAID_BOX = "mt-0.5 mb-1 text-[0.8125rem] leading-snug"

/**
 * The key handler a row's editor wants: read the key against the map, and let
 * the field have anything the map does not claim.
 *
 * Here rather than in each component because "which keys are the editor's" is
 * one question with one answer (../keys.ts) and two copies of the
 * `preventDefault` would be two chances to leave `Tab` moving focus out of the
 * outline.
 *
 * It is also the ONE place the caret is read off the DOM, and that is the whole
 * reason {@link Caret} is a value: two of the keys mean different things
 * depending on where in the line they were pressed (`Enter` splits mid-text,
 * `Backspace` merges at offset zero), and everything on either side of this
 * function — the matcher above it, the editor below it — is testable without a
 * browser because neither of them touches an element.
 *
 * WHETHER THIS IS A VIM EDITOR is read here too, from the preference, and
 * handed to the map — which is what decides `Escape` (`../keys.ts` argues it).
 * Only a prose field can be one: a title is one line in an `<input>`, and vim
 * over a single-line field is a mode nobody asked for. Read inside the handler
 * rather than closed over, so a person who turns the preference on while a
 * note is open gets the answer the editor beside them already has.
 */
export const keyHandler = (
  field: EditField,
  press: (action: EditAction, at?: Caret) => void,
) =>
(event: KeyboardEvent): void => {
  // Not in a NOTE, where the matcher answers before it would ever look
  // (../keys.ts: a note is prose, and the keys that edit a row are the row's).
  // Reading it anyway would materialise the whole editor's value per keystroke
  // to take its length — a prose block, on the one field that can be long.
  const at = field === "line" ? caretOf(event.currentTarget) : undefined
  const vim = field !== "line" && vimEditing()
  const action = editKey(event, field, at, vim)
  if (action === null) {
    // Nothing of the app's — and for one key that is not the same as nobody's.
    // A vim editor's `Escape` is the mode switch, and the panels that shut on
    // Escape listen on the document (`../dismiss.ts`), so it has to stop here
    // or it folds the row the editor is inside.
    if (heldByVim(event, vim)) event.stopPropagation()
    return
  }
  event.preventDefault()
  // Stop it there: the palette listens on the window, and an outline key that
  // also reached a global handler would be one keystroke doing two things.
  event.stopPropagation()
  press(action, at)
}

/** The selection in the field a key was pressed in, or `undefined` for
 *  anything that is not one — which is not a case a row's editor reaches, and
 *  is answered rather than asserted because a handler that threw would take a
 *  keystroke down with it. */
const caretOf = (target: EventTarget | null): Caret | undefined => {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
    return undefined
  }
  const { selectionStart, selectionEnd, value } = target
  if (selectionStart === null || selectionEnd === null) return undefined
  return { start: selectionStart, end: selectionEnd, text: value }
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
 *
 * `wanted` is the third answer, and only a split or a merge ever gives one: the
 * point of both keys is that the caret stays where the sentence was cut or
 * joined, which is neither the end of the text nor where it was in the editor
 * that has just gone away. It is read from the DRAFT rather than remembered
 * here, because the draft is what survives the row being redrawn.
 */
const takeCaret = (
  element: () => HTMLInputElement,
  /** Named rather than positional, because a caller wants one or the other of
   *  them and a positional `undefined` in the middle is a call site that reads
   *  as a mistake. */
  said: {
    /** Where the caret goes when the editor OPENS, when the draft says. */
    readonly at?: () => number | undefined
    /** Anything else the caret arriving implies: the title's own reading of
     *  WHERE the caret now is — this function moved it, so anything tracking it
     *  has to be told rather than left waiting for an event that will not
     *  come. */
    readonly then?: () => void
  } = {},
): void => {
  const editor = useEditor()
  let opening = true
  createEffect(on(editor.caret, () => {
    const field = element()
    const at = opening
      ? said.at?.() ?? field.value.length
      : field.selectionStart ?? field.value.length
    opening = false
    field.focus()
    field.setSelectionRange(at, at)
    said.then?.()
  }))
}
