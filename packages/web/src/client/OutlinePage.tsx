/**
 * One whole outline: the roots of a file, expanded.
 *
 * The tree it draws is the same `<Tree>` a zoomed node draws, over rows from
 * the same derivation — a file is just the widest zoom there is.
 */

import { type Derived, rowsOf } from "@olai/format"
import { createMemo } from "solid-js"

import { DoneToggle } from "./DoneToggle.tsx"
import { Tree } from "./Tree.tsx"
import type { View } from "./view.ts"

export function OutlinePage(props: {
  readonly derived: Derived
  readonly file: string
  readonly view: View
}) {
  const rows = createMemo(() => props.view.visible(rowsOf(props.derived, props.file)))

  return (
    <>
      <header class="mb-4 flex items-baseline justify-end">
        <DoneToggle hidden={props.view.doneHidden()} onToggle={props.view.toggleDone} />
      </header>
      <Tree
        rows={rows()}
        collapsed={props.view.collapsed()}
        onToggle={props.view.toggle}
      />
    </>
  )
}
