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
