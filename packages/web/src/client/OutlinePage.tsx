/**
 * One whole outline: the roots of a file, expanded.
 *
 * The tree it draws is the same `<Tree>` a zoomed node draws, over rows from
 * the same derivation and the same store — a file is just the widest zoom
 * there is.
 */

import type { Row } from "@olai/format"
import { Show } from "solid-js"

import { DoneToggle } from "./DoneToggle.tsx"
import { Editable } from "./edit/Editable.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { Tree } from "./Tree.tsx"
import type { View } from "./view.ts"

export function OutlinePage(props: {
  /** Which file this is — needed by exactly one thing, and it is the one
   *  place a browser names a path: an outline with no rows has no anchor to
   *  put a first one after. */
  readonly file: string
  readonly rows: ReadonlyArray<Row>
  readonly view: View
}) {
  return (
    <Editable rows={() => props.rows} view={props.view}>
      {/* A HEADER LINE, not a dead band: the file crumb and the Done pill
          share one row so the sheet's top is inhabited, the way a zoomed
          page already sits the crumbs beside the same pill. */}
      <header class="mb-5 flex items-baseline justify-between gap-4">
        <h1
          class="m-0 min-w-0 truncate font-mono text-sm text-muted"
          title={props.file}
        >
          {props.file}
        </h1>
        <DoneToggle hidden={props.view.doneHidden()} onToggle={props.view.toggleDone} />
      </header>
      <Tree rows={props.rows} view={props.view} section />
      {/* An outline that holds nothing still has to be startable, and a tree
          of no rows offers nowhere to press a key. Only when the file really
          is empty: rows can also be missing because this reading is hiding
          what is done, and "write its first line" would be a lie over a tree
          that is one click from coming back. */}
      <Show when={props.rows.length === 0 && !props.view.doneHidden()}>
        <StartLine
          at={{ kind: "first", file: props.file }}
          label="This outline is empty — write its first line."
        />
      </Show>
    </Editable>
  )
}
