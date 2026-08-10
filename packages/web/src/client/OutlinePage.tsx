/**
 * One whole outline: the roots of a file, expanded.
 *
 * The tree it draws is the same `<Tree>` a zoomed node draws, over rows from
 * the same derivation and the same store — a file is just the widest zoom
 * there is.
 */

import type { Row } from "@olai/format"

import { DensityToggle } from "./DensityToggle.tsx"
import { DoneToggle } from "./DoneToggle.tsx"
import { Tree } from "./Tree.tsx"
import type { View } from "./view.ts"

export function OutlinePage(props: {
  readonly rows: ReadonlyArray<Row>
  readonly view: View
}) {
  return (
    <>
      <header class="mb-4 flex items-baseline justify-end gap-2">
        <DensityToggle
          density={props.view.density()}
          onToggle={props.view.toggleDensity}
        />
        <DoneToggle hidden={props.view.doneHidden()} onToggle={props.view.toggleDone} />
      </header>
      <Tree rows={props.rows} view={props.view} />
    </>
  )
}
