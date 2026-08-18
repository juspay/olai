/**
 * One whole outline: the roots of a file, expanded.
 *
 * The tree it draws is the same `<Tree>` a zoomed node draws, over rows from
 * the same derivation and the same store — a file is just the widest zoom
 * there is.
 */

import type { Row } from "@olai/format"
import { Show } from "solid-js"

import { Editable } from "./edit/Editable.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { unfiltered } from "./filter/why.ts"
import { doneHidden } from "./settings/done.ts"
import { Tree } from "./Tree.tsx"

export function OutlinePage(props: {
  /** Which file this is — needed by exactly one thing, and it is the one
   *  place a browser names a path: an outline with no rows has no anchor to
   *  put a first one after. */
  readonly file: string
  readonly rows: ReadonlyArray<Row>
}) {
  const narrowed = useNarrowed()
  return (
    // A whole outline is drawn inside nothing, which is the answer rather than
    // the absence of one (`./drag/fields.ts`).
    <Editable rows={() => props.rows} file={props.file} within={[]}>
      <Tree rows={props.rows} />
      {/* An outline that holds nothing still has to be startable, and a tree
          of no rows offers nowhere to press a key. Only when the file really
          is empty: rows can also be missing because this reading is hiding
          what is done — or because a FILTER matched nothing — and "write its
          first line" would be a lie over a tree that is one click from coming
          back. The filter bar says what happened in that case. */}
      <Show
        when={unfiltered(narrowed) && props.rows.length === 0 && !doneHidden()}
      >
        <StartLine
          at={{ kind: "first", file: props.file }}
          label="This outline is empty — write its first line."
        />
      </Show>
    </Editable>
  )
}
