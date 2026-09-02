/**
 * Empty drafts at one place: the parked ones first (Enter Enter Enter), then
 * the live caret if it is here. Tree and StartLine both draw this, so there
 * is one wiring of NewRow rather than two that can disagree about blur,
 * resume, or which input takes the caret.
 *
 * Parked inputs do not take focus; clicking one resumes it.
 */

import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import type { Pending } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { NewRow } from "./NewRow.tsx"
import { keyHandler } from "./RowEditor.tsx"

export function Ghosts(props: {
  readonly parked: ReadonlyArray<Pending>
  readonly live: Pending | undefined
}) {
  const editor = useEditor()
  return (
    <>
      <Key each={props.parked} by="slot">
        {(draft) => (
          <NewRow
            draft={draft()}
            active={false}
            onActivate={() => editor.resume(draft().slot)}
            onInput={editor.type}
            onKey={keyHandler("line", editor.press)}
            onBlur={(left) => editor.blur({ row: draft().slot, field: "new" }, left)}
          />
        )}
      </Key>
      <Show when={props.live}>
        {(draft) => (
          <NewRow
            draft={draft()}
            onInput={editor.type}
            onKey={keyHandler("line", editor.press)}
            onBlur={(left) => editor.blur({ row: draft().slot, field: "new" }, left)}
          />
        )}
      </Show>
    </>
  )
}
