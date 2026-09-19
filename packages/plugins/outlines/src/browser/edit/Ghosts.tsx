/**
 * Empty drafts at one place: the parked ones first (Enter Enter Enter), then
 * the live caret if it is here. Tree and StartLine both draw this, so there
 * is one wiring of NewRow rather than two that can disagree about blur,
 * resume, or which input takes the caret.
 *
 * Parked inputs do not take focus; clicking one resumes it.
 */

import { Key } from "@solid-primitives/keyed"
import { createMemo } from "solid-js"

import type { Ghost, Pending } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { NewRow } from "./NewRow.tsx"
import { keyHandler } from "./RowEditor.tsx"

export function Ghosts(props: {
  readonly parked: ReadonlyArray<Pending>
  readonly live: Ghost | undefined
}) {
  // One keyed list preserves the input when its slot changes from parked to
  // active. Removing from one list and adding to another loses browser focus.
  //
  // A PARKED blank is a ghost too, and its address is the one thing the two
  // have to agree about: the slot it minted (`./draft.ts`'s `Ghost`). That is
  // what makes this list's KEY the same key either side of a landing.
  const drafts = createMemo(() => {
    const live = props.live
    const parked = props.parked
      .filter((draft) => live === undefined || draft.slot !== live.slot)
      .map((draft): Ghost => ({ draft, slot: draft.slot }))
    return live === undefined ? parked : [...parked, live]
  })
  return (
    <Key each={drafts()} by="slot">
      {(line) => <GhostRow line={line()} active={props.live?.slot === line().slot} />}
    </Key>
  )
}

/** Slot is captured as a string at mount: a blur fires as this row unmounts
 *  (Enter spent the draft, a mirror took its place), and reading the
 *  `<Show>`/`<Key>` accessor then is the stale-value throw. */
function GhostRow(props: {
  readonly line: Ghost
  readonly active?: boolean
}) {
  const editor = useEditor()
  const slot = props.line.slot
  return (
    <NewRow
      line={props.line}
      active={props.active}
      onActivate={props.active === false ? () => editor.resume(slot) : undefined}
      onParkedInput={(text) => editor.typeParked(slot, text)}
      onInput={editor.type}
      onKey={keyHandler("line", editor.press)}
      onBlur={(left) => editor.blur({ row: slot, field: "new" }, left)}
    />
  )
}
