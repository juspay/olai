/**
 * The markdown editor, as a component — the one both surfaces mount.
 *
 * A note under a row and a whole document are the same editor at two sizes
 * (the ruling's own words), so they are one component with one contract: the
 * text, what has just been typed in it, the keys, the blur, and the box the
 * caller draws it in. What differs between them is entirely that box and the
 * autosave around it, which are the callers' — `../edit/RowEditor.tsx` and
 * `../document/DocEditor.tsx`.
 *
 * TWO FACES, and the plain one is not a placeholder. CodeMirror arrives in a
 * chunk (./chunk.ts), so until it lands — and forever, if it never does — this
 * draws the TEXTAREA this app shipped before live preview existed: the same
 * text, the same keys, the same commits, markers visible. That is what makes
 * deferring ~700 kB honest rather than a gamble; nothing about writing is
 * gated on a fetch.
 *
 * THE SWAP KEEPS THE CARET. `where` remembers the offset the plain face last
 * had, so a person who started typing into the textarea and had the editor
 * land under them carries on from the same character rather than from the end
 * of the line. It is a signal read only at mount time by the face that
 * replaces it, which is why the two faces can share it without either watching
 * the other.
 */

import { createEffect, createSignal, on, onCleanup, onMount, Show } from "solid-js"

import { editorFailure, editorNow, editorReady } from "./chunk.ts"
import { vimEditing } from "../settings/vim.ts"

/**
 * A mounted editor, named without naming the module it comes from.
 *
 * An `import type` would be erased by the transform and cost nothing — but the
 * sweep that keeps CodeMirror out of the first-paint bundle
 * (`../claims.test.ts`) reads specifiers, not types, and cannot tell an erased
 * import from a real one. A rule nothing can check is a rule that will be
 * broken by an edit that looks fine. So the type is derived from the chunk's
 * own accessor instead, which is a value this file already holds.
 */
type Mounted = ReturnType<ReturnType<typeof editorNow>["mount"]>

export interface MdeProps {
  /** The text being edited — the SOURCE, verbatim, which is the whole point. */
  readonly text: string
  /** What is in it now. Every change a person made, as it happens: the
   *  caller's debounce is what decides when that becomes a write. */
  readonly onInput: (text: string) => void
  /** A key, for the app's own registry (`../keys.ts`). What the app does not
   *  claim stays the editor's. */
  readonly onKey: (event: KeyboardEvent) => void
  /** The caret left. `left` says whether the editor is still in the document,
   *  since one removed by a re-render did not lose focus to a person. */
  readonly onBlur: (left: boolean) => void
  /** The box: the note's inline face, the document's panel. The caller's,
   *  exactly as the textarea's was. */
  readonly class: string
  readonly testid: string
  /** The accessible name, for the editor that is a control on a page rather
   *  than a line inside a row. */
  readonly label?: string
  /** Where the caret goes when this editor OPENS. Absent is the end of the
   *  text, which is what clicking into a note means. */
  readonly caret?: number
  /** A counter whose every bump means "take the caret back" — the row
   *  editor's, after an op that redrew the row the key was pressed in. */
  readonly take?: () => number
  /** Whether the plain face grows with its content. A note does (it is two
   *  lines and occasionally twenty); a document's box is a panel with a
   *  minimum height and a drag handle. */
  readonly grows?: boolean
}

export function Mde(props: MdeProps) {
  // Where the caret was in the face being replaced. Seeded with what the
  // caller asked for, which is the answer for the face that mounts first.
  const [where, setWhere] = createSignal(props.caret)

  return (
    <Show
      when={editorReady()}
      fallback={<Plain {...props} caret={where()} onCaret={setWhere} />}
    >
      <Live {...props} caret={where()} />
    </Show>
  )
}

/**
 * The editor proper: CodeMirror, mounted into a div of the caller's shape.
 *
 * Everything reactive about it is an effect over the mounted handle rather
 * than a re-render — an editor is a stateful thing with a caret in it, and
 * re-creating one because a prop changed would throw away the selection, the
 * undo history and the composition in flight.
 */
function Live(props: MdeProps) {
  let host!: HTMLDivElement
  let editor: Mounted | undefined
  /** This editor is being taken out of the document — see {@link left}. */
  let leaving = false

  onMount(() => {
    const mounted = editorNow().mount(host, {
      doc: props.text,
      vim: vimEditing(),
      typed: (text) => props.onInput(text),
      key: (event) => props.onKey(event),
      blurred: (from) => props.onBlur(left(leaving, from)),
      // ON THE EDITABLE ELEMENT, which for this face is CodeMirror's own
      // content and for the plain one is the textarea. Same marks, same
      // element, so "the caret is in the editor" is one question with one
      // answer whichever face is on screen.
      attributes: {
        "data-testid": props.testid,
        "data-mde": "preview",
        ...(props.label === undefined ? {} : { "aria-label": props.label }),
      },
    })
    editor = mounted
    onCleanup(() => {
      leaving = true
      mounted.destroy()
    })
    // Opening puts the caret at the end of the text — a click into a note
    // means "carry on writing" — unless the caller has an opinion, which only
    // a split or a merge ever has.
    mounted.focus(props.caret ?? props.text.length)
  })

  // Text that did not come from typing: an undo, a draft the app replaced. The
  // handle declines a write that would change nothing, so the ordinary case —
  // this prop echoing what was just typed — dispatches nothing at all.
  createEffect(() => editor?.write(props.text))

  // The caret, taken BACK: where it already is, because a `Tab` in the middle
  // of a word must not throw the reader to the end of the line. Deferred, so
  // the counter's current value is not a second focus on the frame that
  // mounted this.
  createEffect(on(() => props.take?.(), () => editor?.focus(), { defer: true }))

  // The preference, under a live editor: a compartment, so turning vim on does
  // not remount the thing the caret is in.
  createEffect(on(vimEditing, (on) => editor?.vim(on), { defer: true }))

  // The BOX, and nothing else: the marks are on the editable element inside it
  // (above), which is what a caret can be in.
  return <div ref={host} class={props.class} />
}

/**
 * The plain face: the textarea, unchanged.
 *
 * A `desc` is one verbatim markdown string, so a textarea is the honest editor
 * — what is typed is what is stored. It was the whole editor before this item
 * and it is what a reader gets while the chunk is in the air, so it keeps
 * every behaviour it had, the growing box included.
 */
function Plain(props: MdeProps & { readonly onCaret?: (at: number) => void }) {
  let element!: HTMLTextAreaElement
  /** This textarea is being taken out of the document — see {@link left}. */
  let leaving = false
  onCleanup(() => {
    leaving = true
  })

  const read = (): void => props.onCaret?.(element.selectionStart ?? 0)

  onMount(() => {
    const at = props.caret ?? element.value.length
    element.focus()
    element.setSelectionRange(at, at)
    // Where the caret is, told to whoever replaces this face: the offset it
    // was put at, since nothing has moved it yet and no event will say so.
    read()
    if (props.grows === true) grow(element)
  })

  createEffect(on(() => props.take?.(), () => {
    const at = element.selectionStart ?? element.value.length
    element.focus()
    element.setSelectionRange(at, at)
  }, { defer: true }))

  return (
    <textarea
      ref={element}
      class={props.class}
      data-testid={props.testid}
      data-mde={editorFailure() === undefined ? "waiting" : "plain"}
      aria-label={props.label}
      rows={2}
      value={props.text}
      onInput={(event) => {
        if (props.grows === true) grow(event.currentTarget)
        read()
        props.onInput(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        props.onKey(event)
        queueMicrotask(read)
      }}
      onClick={read}
      onSelect={read}
      onBlur={() => props.onBlur(left(leaving, element.isConnected))}
    />
  )
}

/**
 * Did the CARET go somewhere else, or was this editor taken out of the
 * document underneath it?
 *
 * The distinction is `../edit/editing.tsx`'s (`Editor.blur`): a person looking
 * somewhere else COMMITS and closes the draft; an element removed by a
 * re-render did not lose focus to anybody, so the draft stays open and the
 * caret is put back. Getting it wrong the second way closes the row somebody
 * is mid-keystroke in.
 *
 * TWO ANSWERS RATHER THAN ONE, because the swap this component makes is
 * exactly the case a single one gets wrong. When the chunk lands under an open
 * editor, the textarea is replaced by CodeMirror — and browsers disagree about
 * whether a focused element that is being removed fires `blur` before or after
 * it is detached. `isConnected` alone is therefore true in some of them, which
 * reads as "the reader clicked away" and closes the note they are writing. The
 * component knows better: it is the thing doing the removing, so it says so.
 */
const left = (leaving: boolean, connected: boolean): boolean => !leaving && connected

/**
 * A textarea that is as tall as what is in it.
 *
 * Measuring costs a synchronous layout — `height: auto` invalidates, reading
 * `scrollHeight` forces the recompute — and that is per keystroke in an open
 * note. It is paid rather than optimised away: a guard comparing the height
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
