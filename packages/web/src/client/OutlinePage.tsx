/**
 * One whole outline: the roots of a file, expanded.
 *
 * The tree it draws is the same `<Tree>` a zoomed node draws, over rows from
 * the same derivation — a file is just the widest zoom there is.
 */

import { type Derived, rowsOf, withoutDone } from "@olai/format"
import { createMemo, Show } from "solid-js"

import { DoneToggle } from "./DoneToggle.tsx"
import { Tree } from "./Tree.tsx"
import type { View } from "./view.ts"

export function OutlinePage(props: {
  readonly derived: Derived
  /** The outline open, or `undefined` when the URL names one we do not have. */
  readonly file: string | undefined
  /** What the URL asked for, which is what tells the two empties apart. */
  readonly requested: string | null
  readonly files: ReadonlyArray<string>
  readonly view: View
}) {
  const rows = createMemo(() => {
    const file = props.file
    if (file === undefined) return []
    const rows = rowsOf(props.derived, file)
    return props.view.doneHidden() ? withoutDone(rows) : rows
  })

  return (
    <Show when={props.file !== undefined} fallback={<Empty {...props} />}>
      <header class="mb-4 flex items-baseline justify-end">
        <DoneToggle hidden={props.view.doneHidden()} onToggle={props.view.toggleDone} />
      </header>
      <Tree
        rows={rows()}
        collapsed={props.view.collapsed()}
        onToggle={props.view.toggle}
      />
    </Show>
  )
}

/** Two different nothings, said differently: the directory holds no outlines,
 *  or it holds outlines and none of them is the one this URL names. */
function Empty(props: {
  readonly requested: string | null
  readonly files: ReadonlyArray<string>
}) {
  return (
    <p class="text-muted">
      {props.requested !== null && props.files.length > 0
        ? `No outline named ${props.requested} under the served directory.`
        : "No .jsonl outlines under the served directory."}
    </p>
  )
}
