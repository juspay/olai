/**
 * The panel's body, as somewhere to drop a file.
 *
 * The target is the transcript AND the composer, not the two-line box alone: a
 * picture dragged at a conversation is aimed at the conversation, and a target
 * you can miss by two pixels is a target that eats the file — a drop the page
 * does not take is a drop the BROWSER takes, by navigating away to the file
 * and taking the open outline with it.
 *
 * So the region that lights up is exactly the region that takes it. The
 * affordance is the point of this component: a person must be able to see
 * where the file will land before they let go of it, and every drop target
 * that has ever been guessed at was a drop target somebody dropped beside.
 *
 * Three details that are not obvious and are all load-bearing:
 *
 *   - **`dragover` must `preventDefault()`** or the browser refuses the drop
 *     and navigates to the file instead. That call IS the "yes, drop here";
 *     there is no other way to say it.
 *   - **enter and leave are COUNTED**, because they fire per ELEMENT, not per
 *     target: dragging across the transcript fires `dragleave` for every row
 *     the cursor crosses, each one immediately followed by a `dragenter` for
 *     the next. A boolean flickers the affordance off and on the whole way
 *     across; the depth is zero only when the drag has actually left.
 *   - **the overlay is `pointer-events-none`**, so drawing it under the cursor
 *     does not itself count as leaving the thing underneath — which would be
 *     the affordance putting itself out the moment it appeared.
 *
 * A drag carrying anything OTHER than files is left entirely alone (no lit
 * panel, no `preventDefault`), so dragging a selection into the box still
 * types it there.
 */

import { createSignal, type JSX, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { carriesFiles, droppedFiles } from "./drop.ts"

export function DropTarget(props: {
  /** What was dropped, in order. Never called for a drag that carried no
   *  files, because such a drag was never this component's to take. */
  readonly onFiles: (files: ReadonlyArray<File>) => void
  readonly children: JSX.Element
}) {
  const [over, setOver] = createSignal(false)
  /** How many nested elements the drag is currently inside. See the header:
   *  this is what makes crossing a transcript one drag rather than forty. */
  let depth = 0

  const carrying = (event: DragEvent): boolean =>
    carriesFiles(event.dataTransfer?.types ?? [])

  const done = () => {
    depth = 0
    setOver(false)
  }

  return (
    <div
      class="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!carrying(event)) return
        depth += 1
        setOver(true)
      }}
      onDragOver={(event) => {
        if (!carrying(event)) return
        event.preventDefault()
        // What the cursor says this drop would do. A copy: the file stays
        // wherever it was dragged from, and olai takes a copy of the bytes.
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={(event) => {
        if (!carrying(event)) return
        depth -= 1
        if (depth <= 0) done()
      }}
      onDrop={(event) => {
        if (!carrying(event)) return
        event.preventDefault()
        done()
        props.onFiles(droppedFiles(event.dataTransfer))
      }}
    >
      {props.children}

      <Show when={over()}>
        <div
          class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed border-accent bg-paper/85"
          data-testid={TESTID.chatDrop}
        >
          <span class="rounded border border-accent px-2 py-1 font-mono text-xs text-accent">
            drop to attach
          </span>
        </div>
      </Show>
    </div>
  )
}
