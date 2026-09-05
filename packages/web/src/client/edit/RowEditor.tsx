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
 * Styled to be invisible: the same font, size, weight, colour and leading as
 * the title it replaces, no border, no background, no ring. A row must not
 * jump when it becomes editable, so the input's box is the title span's box
 * — `w-full` inside the same flex cell, `appearance-none`, and an explicit
 * `1.5em` height (the markdown body's leading) so the UA's own line box
 * cannot win. A section keeps its heavier type (`section`), or a top-level
 * row would shrink the moment the caret arrived.
 *
 * {@link DraftSaid} is drawn wherever an editor is, and that is why it lives
 * here rather than in the tree: a refusal must be visible for EVERY draft, and
 * two of the places a draft can be — a new row on an empty outline, a row whose
 * parent is folded — are places the tree draws no body under.
 */

import { createEffect, createSignal, on, Show } from "solid-js"

import { createCompletion } from "../complete/completing.tsx"
import type { Draft } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { SaidLine } from "../SaidLine.tsx"
import { type Caret, type EditAction, type EditField, editKey } from "../keys.ts"
import { TESTID } from "../testids.ts"
import { ROW_NOTE as AS_NOTE, ROW_TITLE, SECTION_TITLE } from "../touch.ts"

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
   *  opinion — a split, a merge, an indent, or a click, the four after which the
   *  end of the text is the wrong place to be ({@link ./draft.ts}'s `caret`).
   *  Absent is the end of the text: the filler, a note, the move-to picker
   *  handing the row back. */
  readonly caret?: number
  /** This row is a section heading — the same fact {@link ../NodeLine.tsx}
   *  draws, so the input is the same type as the title it replaces. Absent
   *  is a row. */
  readonly section?: boolean
  /** This editor holds the caret. A parked empty draft is an input so it
   *  can be clicked back into, but it must not take focus on mount — there
   *  is still only one caret. Absent is live, which is every other caller. */
  readonly active?: boolean
  /** The parked input was focused: put the caret here. */
  readonly onActivate?: () => void
  readonly onParkedInput?: (text: string) => void
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

  takeCaret(() => element, {
    at: () => props.caret,
    then: readCaret,
    armed: () => props.active !== false,
  })

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
    // hangs off this box (Kobalte's popper, portalled) so the row's own
    // geometry is untouched (../complete/Completions.tsx says why it is
    // not in flow).
    <span class="relative flex min-w-0 flex-1">
      <input
        ref={element}
        type="text"
        class={`m-0 h-[1.5em] w-full min-h-0 flex-1 appearance-none border-0 bg-transparent p-0 text-ink outline-none ${props.section === true ? SECTION_TITLE : ROW_TITLE}`}
        data-testid={TESTID.titleEditor}
        value={props.text}
        placeholder={props.placeholder}
        autocomplete="off"
        spellcheck={false}
        onInput={(event) => {
          readCaret()
          // Activation can wait on the previous row's write. Keep these
          // keystrokes with the clicked slot while that write settles.
          if (props.active === false) {
            props.onParkedInput?.(event.currentTarget.value)
            return
          }
          props.onInput(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          if (props.active === false) return
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
        onFocus={() => {
          readCaret()
          if (props.active === false) props.onActivate?.()
        }}
        onBlur={() => props.onBlur(element.isConnected)}
      />
      <completion.Panel />
    </span>
  )
}

/**
 * The note, as the text it is.
 *
 * A `desc` is one verbatim markdown string, so a textarea is the honest
 * editor: what is typed is what is stored, and the rendering comes back when
 * it closes. It grows with its content because a note is usually two lines and
 * occasionally twenty, and a fixed box would be wrong for both.
 *
 * INLINE, and styled as the note rather than as a control (human, on sight of
 * the first shape: a monospace box under the row is ugly, and it is also a
 * lie — it says "form field" where the page says "the note"). Same size, same
 * muted tone, same place, no border and no background: what changes when the
 * caret arrives is that the markdown stops being rendered and starts being
 * text, which is exactly the trade the title takes one line up.
 */
export function DescEditor(props: {
  readonly text: string
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
  /** Where the caret goes when this editor OPENS, when the draft has an
   *  answer — {@link takeCaret}'s contract; a click measured in the note's
   *  clamped line is the one call that has one ({@link ../NodeBody.tsx}).
   *  Absent is the end, which is where a note's text always ends up being
   *  continued. */
  readonly caret?: number
}) {
  let element!: HTMLTextAreaElement
  takeCaret(() => element, { at: () => props.caret, then: () => grow(element) })

  return (
    <textarea
      ref={element}
      class={`mt-0.5 mb-1 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ${AS_NOTE}`}
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
 * WHERE the two lines sit — under the editor, in the row's own type size. The
 * one thing about them that is this file's, for {@link SaidLine}'s reason: a
 * said-line's mood is one decision for the whole client, and where it hangs is
 * the caller's.
 */
const UNDER_EDITOR = "mt-0.5 mb-1 text-[0.8125rem] leading-snug"

/**
 * What the last write said, under the editor it was typed in.
 *
 * NAMED FOR ITS SURFACE, the way `../menu/MenuSaid.tsx` and `./UndoSaid.tsx`
 * are, because `Said` alone is the TYPE every one of these lines carries
 * (`../saying.ts`) — a rule `packages/web/README.md` states and this file was
 * the one place breaking.
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
 *
 * BOTH GO THROUGH {@link SaidLine} — the last two of the client's said lines
 * to do so, because joining changed what a screen reader is told rather than
 * only what the markup says. The two moods here ARE the component's two moods,
 * so the refusal is unchanged for a reader: it was already `role="alert"`,
 * which carries `aria-live="assertive"` whether or not the attribute is
 * written down.
 *
 * THE NUDGE IS THE RULING. It carried no `role` and no `aria-live` at all, so
 * a remark the ops layer makes about a write that LANDED — the last task under
 * a parent going done — reached only the reader who could see it. It is
 * announced now, because it is feedback rather than decoration and the person
 * who pressed the key is exactly who it is for; and POLITELY rather than
 * assertively, because it rides back on something that did happen and
 * interrupting a sentence somebody is in the middle of, to say a parent could
 * now be ticked, is worse than the advice is worth.
 */
export function DraftSaid(props: { readonly draft: Draft }) {
  return (
    <>
      <Show when={props.draft.refused}>
        {(failure) => (
          <SaidLine
            said={{ tone: "alarm", text: failure().message, kind: failure()._tag }}
            class={UNDER_EDITOR}
            testid={TESTID.editRefusal}
          />
        )}
      </Show>
      <Show when={props.draft.nudge}>
        {(nudge) => (
          <SaidLine
            said={{ tone: "aside", text: nudge() }}
            class={UNDER_EDITOR}
            testid={TESTID.editNudge}
          />
        )}
      </Show>
    </>
  )
}

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
 */
export const keyHandler = (
  field: EditField,
  press: (action: EditAction, at?: Caret) => void,
) =>
(event: KeyboardEvent): void => {
  // Not in a NOTE, where the matcher answers before it would ever look
  // (../keys.ts: a note is prose, and the keys that edit a row are the row's).
  // Reading it anyway would materialise the whole textarea's value per
  // keystroke to take its length — a prose block, on the one field that can be
  // long.
  const at = field === "line" ? caretOf(event.currentTarget) : undefined
  const action = editKey(event, field, at)
  if (action === null) return
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
 * `opening` is for: a fresh editor without an offset puts it at the end of
 * the text, which is the filler and a note; a click names the offset it
 * landed on (`./point.ts`) and a split, a merge or an indent name theirs;
 * a caret being taken BACK goes where it already was, so `Tab` in the
 * middle of a word does not throw the reader to the end of the line.
 *
 * `wanted` is the third answer, and three keys give one: a split and a merge,
 * whose point is that the caret stays where the sentence was cut or joined, and
 * an indent, whose point is that it does not move at all — an indent redraws
 * the row at a new `Row.key`, so this component is not moved but REPLACED,
 * and `opening` is true in a box the reader never left. None of the three is
 * the end of the text, nor where the caret was in the editor that has just gone
 * away. It is read from the DRAFT rather than remembered here, because the
 * draft is what survives the row being redrawn ({@link ./draft.ts}'s `caret`).
 */
const takeCaret = (
  element: () => HTMLInputElement | HTMLTextAreaElement,
  /** Named rather than positional, because the two callers want different ONES
   *  of them and a positional `undefined` in the middle is a call site that
   *  reads as a mistake. */
  said: {
    /** Where the caret goes when the editor OPENS, when the draft says. */
    readonly at?: () => number | undefined
    /** Anything else the caret arriving implies: the note's box growing to fit
     *  what is in it, and the title's own reading of WHERE the caret now is —
     *  this function moved it, so anything tracking it has to be told rather
     *  than left waiting for an event that will not come. */
    readonly then?: () => void
    /** Whether this editor is the caret. A parked empty draft is an input
     *  so it can be clicked; it must not take the caret when another one
     *  bumps. Absent is live. */
    readonly armed?: () => boolean
  } = {},
): void => {
  const editor = useEditor()
  let opening = true
  createEffect(on(editor.caret, () => {
    if (said.armed?.() === false) return
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
