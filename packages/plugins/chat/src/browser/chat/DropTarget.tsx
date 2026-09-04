/**
 * The panel's body, as somewhere to drop a file.
 *
 * The target is the transcript AND the composer, not the two-line box alone: a
 * file dragged at a conversation is aimed at the conversation, and a target
 * you can miss by two pixels is a target that eats the file — a drop this
 * region does not take is one the BROWSER takes, by navigating away to the
 * file and taking the open page with it.
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
 *   - **the drag is COUNTED IN AND OUT**, because enter and leave fire per
 *     ELEMENT, not per target: dragging across the transcript fires
 *     `dragleave` for every row the cursor crosses, each one immediately
 *     followed by a `dragenter` for the next. A boolean flickers the
 *     affordance off and on the whole way across; a depth is zero only when
 *     the drag has actually left. It is a signal rather than a flag beside
 *     one, because "is a drag over this" is a fact the count already holds —
 *     `<Show>` compares its condition by truthiness, so crossing rows moves
 *     the number without touching the overlay. What a count must never do is
 *     outlive the drag: an affordance left lit over a conversation nothing is
 *     being dragged across is a panel that looks broken and cannot be talked
 *     out of it, so every way a drag can END puts it back — the drop, the
 *     leave, and `dragend`.
 *   - **the overlay is `pointer-events-none`**, so drawing it under the cursor
 *     does not itself count as leaving the thing underneath — which would be
 *     the affordance putting itself out the moment it appeared.
 *
 * What a drag is CARRYING is read off `dataTransfer.types` and never off its
 * files, because the spec keeps the drag data store in protected mode until
 * the drop: the files are unreadable the whole way across, and a target that
 * waited for them would never light up at all. `"Files"` is the spec's own
 * name for the kind. A drag carrying anything else — a selection, a link — is
 * left entirely alone (no lit panel, no `preventDefault`), so dragging text
 * into the composer still types it there.
 *
 * Nothing here reaches past `DataTransfer`. A dropped DIRECTORY therefore
 * arrives as one entry the gate does not take, and is refused by name like
 * anything else olai does not take, which is the honest answer for a gesture
 * this app has no way to walk.
 */

import { createSignal, type JSX, Show } from "solid-js"

import { WITHIN } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"

export function DropTarget(props: {
  /** What was dropped, in the order it was dropped. Never called for a drag
   *  that carried no files, because such a drag was never this component's to
   *  take. */
  readonly onFiles: (files: ReadonlyArray<File>) => void
  readonly children: JSX.Element
}) {
  /** How many nested elements the drag is currently inside — see the header:
   *  this is what makes crossing a transcript one drag rather than forty. */
  const [depth, setDepth] = createSignal(0)

  const carrying = (event: DragEvent): boolean =>
    event.dataTransfer?.types.includes("Files") ?? false

  return (
    <div
      // Phone half-sheet: when the strips above leave this shorter than the
      // composer, this is the hatch a finger (and Playwright) uses to reach
      // the box. Desktop never needs it — the transcript is the scroller
      // (`./Transcript.tsx`, `min-h-0`), and an outer overflow here is what
      // made a long turn scroll the composer away with the rows. `md:` is
      // the same 48rem the dock/sheet split uses (`../layout/media.ts`).
      class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain md:overflow-hidden"
      onDragEnter={(event) => {
        if (carrying(event)) setDepth((inside) => inside + 1)
      }}
      onDragOver={(event) => {
        if (!carrying(event)) return
        event.preventDefault()
        // What the cursor says this drop would do. A copy: the file stays
        // wherever it was dragged from, and olai takes a copy of the bytes.
        if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "copy"
      }}
      // Counted out WITHOUT asking what it was carrying, unlike every other
      // handler here. A leave is the end of something that already entered, and
      // the drag data store is protected until a drop — so a browser is within
      // its rights to hand this one an empty store, and a leave that asked
      // first would skip the decrement and leave the panel lit over a
      // conversation nothing is being dragged across. A drag that never
      // incremented (a selection, a link) cannot take the count below zero.
      onDragLeave={() => setDepth((inside) => Math.max(0, inside - 1))}
      // The other way a drag ends with no drop: abandoned, or taken back with
      // Escape. It reaches this listener when the drag STARTED in the page —
      // one of the composer's own thumbnails, say — and not when it started in
      // the desktop, where there is no source node here to fire it. So it is a
      // second net under the count rather than a replacement for it.
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

      <Show when={depth() > 0}>
        <div
          class={`pointer-events-none absolute inset-0 ${WITHIN.cover} flex items-center justify-center rounded border-2 border-dashed border-accent bg-paper/85`}
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
