/**
 * Writing one property, in place under the row — the drawer's other half.
 *
 * `../date/DatePicker.tsx`'s arrangement, deliberately and line for line: a
 * panel under the line it was opened on rather than a popover, Escape and
 * Cancel as the ways out that write nothing, one press at a time, and the ops
 * layer's own words kept on screen when a write is refused. The reasons are
 * that file's — a row already says everything else it has to say in this place,
 * and a floating panel would be the one editing surface with geometry to keep
 * anchored while the page scrolls.
 *
 * WHAT IT SENDS is one `prop` edit, at the same gate `set_prop` goes through,
 * judged by the same planner and refused in the same words. Nothing is echoed:
 * the drawer changes when the file says it changed.
 *
 * The KEY box is read-only while an existing property is being changed, and
 * {@link ./editor.ts} argues why — a rename is two ops, and this face does not
 * get gestures an agent cannot make.
 */

import { createSignal, Show } from "solid-js"

import { type Editing, type Press, pressOf } from "./editor.ts"
import { SaidLine } from "../edit/SaidLine.tsx"
import type { Said } from "../edit/undoing.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"

export function PropEditor(props: {
  /** The property being changed, or `null` for one being added. */
  readonly editing: Editing | null
  /** Send it. The host knows the write gate and the undo stack
   *  (`../writes.ts`); this knows the key and the value. A {@link Said} back
   *  keeps the panel open saying it; nothing back is the ordinary success. */
  readonly onSet: (key: string, value: string) => Promise<Said | undefined>
  readonly onClose: () => void
}) {
  /** The two boxes: seeded from the record ONCE and the person's from then on,
   *  which is the draft rule every editing surface in this app follows — what
   *  is typed is not a claim about the file, and a live frame rewriting a box
   *  under somebody is a page taking their words out of their hands. */
  const [key, setKey] = createSignal(props.editing?.key ?? "")
  const [value, setValue] = createSignal(props.editing?.value ?? "")
  const [said, setSaid] = createSignal<Said | null>(null)
  const [sending, setSending] = createSignal(false)
  const press = (): Press => pressOf(props.editing, key(), value())

  const send = async (): Promise<void> => {
    if (sending() || !press().writes) return
    setSending(true)
    setSaid(null)
    try {
      const answer = await props.onSet(key().trim(), value())
      if (answer !== undefined) {
        setSaid(answer)
        return
      }
      props.onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      class="my-1"
      data-testid={TESTID.propEditor}
      data-key={props.editing?.key}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        // Stopped here, as the picker stops it: the row's editor and the
        // palette both listen for Escape further up, and one key must not close
        // two things.
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
      }}
    >
      <form
        class="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        {/* The labels WRAP their boxes rather than naming them by id: a row
            owns its own editor, so two can be open at once and a fixed id would
            be the same id twice in one document. */}
        <label class="flex items-center gap-2 text-xs text-muted">
          Property
          <input
            type="text"
            class={`${TARGET} md:min-h-0 w-32 rounded border border-rule bg-paper px-2 py-1 font-mono text-xs text-ink read-only:text-muted`}
            data-testid={TESTID.propEditorKey}
            placeholder="key"
            autocomplete="off"
            spellcheck={false}
            readOnly={props.editing !== null}
            value={key()}
            // The caret lands in the box there is something to type in: the key
            // for a new property, the value for one that already has a name.
            ref={(element) =>
              queueMicrotask(() => {
                if (props.editing === null) element.focus()
              })}
            onInput={(event) => setKey(event.currentTarget.value)}
          />
        </label>
        <label class="flex flex-1 items-center gap-2 text-xs text-muted">
          holds
          <input
            type="text"
            class={`${TARGET} md:min-h-0 min-w-0 flex-1 rounded border border-rule bg-paper px-2 py-1 text-sm text-ink`}
            data-testid={TESTID.propEditorValue}
            placeholder="value"
            autocomplete="off"
            spellcheck={false}
            value={value()}
            ref={(element) =>
              queueMicrotask(() => {
                if (props.editing !== null) {
                  element.focus()
                  element.select()
                }
              })}
            onInput={(event) => setValue(event.currentTarget.value)}
          />
        </label>
        <button
          type="submit"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border border-rule bg-transparent px-2 py-1 text-sm text-ink hover:bg-rule disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent`}
          data-testid={TESTID.propEditorSet}
          disabled={sending() || !press().writes}
        >
          {press().label}
        </button>
        <button
          type="button"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-sm text-muted hover:text-ink`}
          data-testid={TESTID.propEditorCancel}
          onClick={() => props.onClose()}
        >
          Cancel
        </button>
      </form>

      <Show when={said()}>
        {(message) => (
          <SaidLine
            said={message()}
            class="mt-1 mb-0 text-[0.8125rem] leading-snug"
            testid={TESTID.propEditorSaid}
          />
        )}
      </Show>
    </div>
  )
}
