/**
 * HTML drag-and-drop:
 *
 *   - `dragover` must `preventDefault()` or the browser refuses the drop and
 *     navigates to the file instead.
 *   - `dragenter`/`dragleave` fire per ELEMENT, not per target.
 *   - the drag data store is in protected mode until the drop, so a drag's
 *     contents are readable only as kinds on `dataTransfer.types` (`"Files"`).
 *   - an element with `pointer-events: none` under the cursor is not a
 *     `dragleave` of what is underneath it.
 */

import { createSignal, type JSX, Show } from "solid-js"

import { WITHIN } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"

export function DropTarget(props: {
  readonly onFiles: (files: ReadonlyArray<File>) => void
  readonly carrying?: string | null
  readonly ref?: (element: HTMLDivElement) => void
  readonly children: JSX.Element
}) {
  const [depth, setDepth] = createSignal(0)

  const carrying = (event: DragEvent): boolean =>
    event.dataTransfer?.types.includes("Files") ?? false

  return (
    <div
      ref={props.ref}
      class="relative flex min-h-0 min-w-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (carrying(event)) setDepth((inside) => inside + 1)
      }}
      onDragOver={(event) => {
        if (!carrying(event)) return
        event.preventDefault()
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={() => setDepth((inside) => Math.max(0, inside - 1))}
      onDragEnd={() => setDepth(0)}
      onDrop={(event) => {
        const transfer = event.dataTransfer
        if (transfer === null || !carrying(event)) return
        event.preventDefault()
        setDepth(0)
        props.onFiles([...transfer.files])
      }}
    >
      {props.children}

      <Show when={depth() > 0 || props.carrying}>
        <div
          class={`pointer-events-none absolute inset-0 ${WITHIN.cover} flex items-center justify-center rounded-control border-2 border-dashed border-accent bg-paper/80`}
          data-testid={TESTID.chatDrop}
          data-carrying={props.carrying ?? undefined}
        >
          <span class="rounded-control border border-accent px-2 py-1 text-label text-accent">
            {props.carrying ?? "Drop to attach"}
          </span>
        </div>
      </Show>
    </div>
  )
}
