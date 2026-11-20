import { createAfterGesture } from "@olai/web/client/after-gesture.ts"
import { useShown } from "olai-plugin-navigation/routing"
import { TESTID } from "olai-plugin-outlines/testids"
import { createMemo, createEffect, createSignal, on, onCleanup, onMount, Show } from "solid-js"

import { takingOfflineFocus } from "@olai/web/client/connection/focus.ts"
import { createCompletion } from "../complete/completing.tsx"
import { type Draft, type Slot, slotOf } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { type Caret, type EditAction, type EditField, editKey } from "@olai/web/client/keys.ts"

import { ROW_NOTE as AS_NOTE, ROW_TITLE, SECTION_TITLE } from "@olai/ui-primitives/touch.ts"

export function TitleEditor(props: {
  readonly slot?: Slot
  readonly text: string
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
  readonly placeholder?: string
  readonly caret?: number
  readonly section?: boolean
  readonly active?: boolean
  readonly onActivate?: () => void
  readonly onParkedInput?: (text: string) => void
  readonly fillsLine?: boolean
}) {
  const shown = useShown()
  const afterGesture = createAfterGesture()
  let element!: HTMLInputElement

  const [caret, setCaret] = createSignal(0)
  const readCaret = (): void => {
    setCaret(element.selectionStart ?? 0)
  }

  takeCaret(() => element, {
    slot: props.slot,
    at: () => props.caret,
    then: readCaret,
    armed: () => props.active !== false,
  })

  const editor = useEditor()
  const draft = editor.draft()
  const completion = createCompletion({
    dismissal: editor.completionDismissal(props.slot ?? (draft === null ? undefined : slotOf(draft))),
    text: () => props.text,
    caret,
    rewrite: (next) => {
      element.value = next.text
      element.setSelectionRange(next.caret, next.caret)
      setCaret(next.caret)
      props.onInput(next.text)
    },
    dated: (day) => editor.dated(day),
    mirrored: (target) => editor.mirrored(target),
  })

  return (
    <span
      class={`relative inline-grid min-h-[1.5em] min-w-0 max-w-full overflow-hidden ${props.section === true ? SECTION_TITLE : ROW_TITLE}`}
      classList={{ "flex-1": props.fillsLine === true }}
    >
      <span
        class="invisible col-start-1 row-start-1 min-w-4 whitespace-pre"
        aria-hidden="true"
      >
        {props.text === "" ? "\u200B" : props.text}
      </span>
      <input
        ref={element}
        type="text"
        class={`absolute left-0 right-0 top-0 m-0 h-[1.5em] w-full min-h-0 appearance-none border-0 bg-transparent p-0 text-ink outline-none ${props.section === true ? SECTION_TITLE : ROW_TITLE}`}
        data-testid={TESTID.titleEditor}
        value={props.text}
        placeholder={props.placeholder}
        enterkeyhint="next"
        autocomplete="off"
        spellcheck={false}
        onInput={(event) => {
          readCaret()
          if (props.active === false) {
            props.onParkedInput?.(event.currentTarget.value)
            return
          }
          props.onInput(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          if (props.active === false) return
          if (completion.key(event)) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          props.onKey(event)
          queueMicrotask(readCaret)
        }}
        onClick={readCaret}
        onSelect={readCaret}
        onFocus={() => {
          readCaret()
          if (props.active === false) props.onActivate?.()
        }}
        onBlur={() => {
          if (takingOfflineFocus()) return
          const blur = props.onBlur
          afterGesture(() => {
            if (shown() && document.activeElement !== element) blur(element.isConnected)
          })
        }}
      />
      <completion.Panel />
    </span>
  )
}

export function DescEditor(props: {
  readonly text: string
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
  readonly caret?: number
}) {
  const shown = useShown()
  const afterGesture = createAfterGesture()
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
      onBlur={() => {
        if (takingOfflineFocus()) return
        afterGesture(() => { if (shown() && document.activeElement !== element) props.onBlur(element.isConnected) })
      }}
    />
  )
}

const UNDER_EDITOR = "mt-0.5 mb-1 text-body leading-snug"

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

export const keyHandler = (
  field: EditField,
  press: (action: EditAction, at?: Caret) => void,
) =>
(event: KeyboardEvent): void => {
  const at = field === "line" ? caretOf(event.currentTarget) : undefined
  const action = editKey(event, field, at)
  if (action === null) return
  event.preventDefault()
  event.stopPropagation()
  press(action, at)
}

const caretOf = (target: EventTarget | null): Caret | undefined => {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
    return undefined
  }
  const { selectionStart, selectionEnd, value } = target
  if (selectionStart === null || selectionEnd === null) return undefined
  return { start: selectionStart, end: selectionEnd, text: value }
}

const takeCaret = (
  element: () => HTMLInputElement | HTMLTextAreaElement,
  said: {
    readonly slot?: Slot
    readonly at?: () => number | undefined
    readonly then?: () => void
    readonly armed?: () => boolean
  } = {},
): void => {
  const shown = useShown()
  const armed = createMemo(() => said.armed?.() !== false)
  const editor = useEditor()
  let opening = true
  const draft = editor.draft()
  const slot = said.slot ?? (draft === null ? undefined : slotOf(draft))
  const was = draft !== null && draft.kind === "row" ? draft.was : undefined
  const retained = editor.takeRange(slot) ?? (was === undefined ? undefined : editor.takeForwarded(was))
  const remember = () => {
    if (!armed() || slot === undefined) return
    const field = element()
    editor.rememberRange({ slot, start: field.selectionStart ?? 0,
      end: field.selectionEnd ?? 0, direction: field.selectionDirection ?? "none" })
  }
  onMount(() => {
    const field = element()
    field.addEventListener("select", remember)
    field.addEventListener("input", remember)
    const selectionChanged = () => {
      if (document.activeElement === field) remember()
    }
    document.addEventListener("selectionchange", selectionChanged)
    onCleanup(() => {
      field.removeEventListener("select", remember)
      field.removeEventListener("input", remember)
      document.removeEventListener("selectionchange", selectionChanged)
    })
  })
  const takeCaret = () => {
    if (!shown()) return
    const pending = editor.resuming()
    if (pending !== null) {
      if (slot?.field !== "new" || slot.row !== pending) return
    } else if (!armed()) return
    const field = element()
    const range = opening ? retained : { start: field.selectionStart ?? field.value.length,
      end: field.selectionEnd ?? field.value.length, direction: field.selectionDirection ?? "none" }
    const at = opening
      ? said.at?.() ?? field.value.length
      : field.selectionStart ?? field.value.length
    opening = false
    field.focus()
    field.setSelectionRange(range?.start ?? at, range?.end ?? at, range?.direction)
    said.then?.()
  }
  onCleanup(editor.onCaret(takeCaret))
  createEffect(on(() => [editor.resuming(), armed(), shown()], () => {
    let current = true
    queueMicrotask(() => { if (current) takeCaret() })
    onCleanup(() => { current = false })
  }))
}

const grow = (element: HTMLTextAreaElement): void => {
  element.style.height = "auto"
  element.style.height = `${element.scrollHeight}px`
}
