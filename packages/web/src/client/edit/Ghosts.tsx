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
  return (
    <>
      <Key each={props.parked} by="slot">
        {(draft) => <GhostRow draft={draft()} active={false} />}
      </Key>
      <Show when={props.live}>
        {(draft) => <GhostRow draft={draft()} />}
      </Show>
    </>
  )
}

/** Slot is captured as a string at mount: a blur fires as this row unmounts
 *  (Enter spent the draft, a mirror took its place), and reading the
 *  `<Show>`/`<Key>` accessor then is the stale-value throw. */
function GhostRow(props: {
  readonly draft: Pending
  readonly active?: boolean
}) {
  const editor = useEditor()
  const slot = props.draft.slot
  return (
    <NewRow
      draft={props.draft}
      active={props.active}
      onActivate={props.active === false ? () => editor.resume(slot) : undefined}
      onInput={editor.type}
      onKey={keyHandler("line", editor.press)}
      onBlur={(left) => editor.blur({ row: slot, field: "new" }, left)}
    />
  )
}
