/**
 * Writing one property, in place under the row — the drawer's other half.
 *
 * The panel is {@link ../edit/RowPanel.tsx}, the shell every surface a row
 * opens shares: under the line rather than floating, Escape and Cancel as the
 * ways out that write nothing, one press at a time, a dead button where the
 * gesture would write nothing, and the ops layer's own words kept on screen
 * when a write is refused. This file used to spell all of that out, and its
 * header used to say it was `../date/DatePicker.tsx`'s arrangement "line for
 * line" — which is the sentence that eventually earned the extraction.
 *
 * WHAT IT SENDS is one `prop` edit, at the same gate `set_prop` goes through,
 * judged by the same planner and refused in the same words. Nothing is echoed:
 * the drawer changes when the file says it changed.
 *
 * The KEY box is read-only while an existing property is being changed, and
 * {@link ./editor.ts} argues why — a rename is two ops, and this face does not
 * get gestures an agent cannot make.
 */

import { createSignal } from "solid-js"

import type { Press } from "../edit/panel.ts"
import { RowPanel } from "../edit/RowPanel.tsx"
import type { Said } from "../saying.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import { type Editing, pressOf } from "./editor.ts"

/** This panel's identity, off the one table that declares it. There is no
 *  notice line here: the two pickers have a stored value their control cannot
 *  hold, and a text box can hold whatever is in the file. */
const IDS = {
  panel: TESTID.propEditor,
  set: TESTID.propEditorSet,
  cancel: TESTID.propEditorCancel,
  said: TESTID.propEditorSaid,
} as const

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
  const press = (): Press => pressOf(props.editing, key(), value())

  return (
    <RowPanel
      ids={IDS}
      press={press}
      send={() => props.onSet(key().trim(), value())}
      onClose={props.onClose}
      about={props.editing?.key}
    >
      {/* The labels WRAP their boxes rather than naming them by id: a row
          owns its own editor, so two can be open at once and a fixed id would
          be the same id twice in one document. */}
      <label class="flex items-center gap-2 text-xs text-muted">
        Property
        <input
          type="text"
          // NARROWER BELOW md, and it is arithmetic rather than taste: this
          // form sits past the row's gutter on a 390pt screen, every width in
          // it is a `rem`, and the type size is now a reader's choice
          // (`../theme/sizes.ts`) — so at `Larger` a fixed 8rem key box put
          // the value box a point off the edge. 6rem was what the old 8rem was
          // in pixels at the size this app used to be nailed to; 5rem is what
          // 6rem became when the default face did. iA Writer Quattro is wider
          // per character than Atkinson was, so the two WORDS in this form —
          // "Property" and "holds", which are type and not boxes — grew, and
          // took the difference out of the value box until it ran 10pt past
          // the edge of a 390pt screen (properties.feature's thumb scenario).
          class={`${TARGET} md:min-h-0 w-20 md:w-32 rounded border border-rule bg-paper px-2 py-1 font-mono text-xs text-ink read-only:text-muted`}
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
      {/* `min-w-0` on the LABEL and not only on the box inside it: a flex
          item's default `min-width: auto` is its content's min-content width,
          so without this the label refused to shrink past the input's own
          intrinsic size and carried the box off the right edge of a 390pt
          screen — which the type-size preference made visible by making
          every rem in here bigger. */}
      <label class="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
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
    </RowPanel>
  )
}
