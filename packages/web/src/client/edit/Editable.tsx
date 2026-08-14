/**
 * A page whose rows can be typed in, picked and moved.
 *
 * The LIFETIME of all three is a page, and that is the whole of what this
 * component decides. It was the app's, and the app is not a thing a draft can
 * belong to: a caret left in a row and then navigated away from would still be
 * open on a day page, whose rows are a query rather than a tree, and the
 * editor would cheerfully re-place it onto whatever it found there. Created
 * here, they go away with the page they were made on, and `useEditor`'s throw
 * becomes a real invariant — a row drawn outside an editable page has no
 * editor to reach for, rather than one that happens to be empty. The same is
 * true of a selection (a set of places in a tree that is not drawn) and of a
 * drag (a gesture over rows that are gone).
 *
 * Which pages those are is then a fact about which pages use this, and there
 * are two: an outline and a zoomed node. A day lists nodes from all over the
 * set and a document is not an outline at all, so neither draws one.
 *
 * THE ORDER THE FOUR ARE MADE IN IS THE DEPENDENCY between them, and it is
 * one way: the selection knows nothing about the caret, the editor hands the
 * caret over to it for the three keys that leave a row, the drag reads the
 * selection to find out whether it is carrying one row or all of them, and the
 * sweep writes a run into it.
 *
 * THE PAGE'S BOX IS THE SWEEP'S SURFACE, and that is the one piece of markup
 * this component owns. A drag-across begins where the outline is NOT
 * (`../drag/sweeping.ts` decides what that means and why), so it needs a box
 * that reaches the bottom of the pane rather than stopping at the last row —
 * otherwise the only empty space on a short outline is a two-pixel gap between
 * lines. One `pointerdown` listener for the whole page rather than one per
 * surface: every scaffolding element bubbles to here, and the gesture answers
 * only for the presses that landed on one.
 *
 * The SELECTION LAYER'S ONE WINDOW LISTENER is here for the reason the editor's
 * keys are on the editor's own element: a pick has no focused element to hang a
 * handler on — that is what makes it a pick rather than a caret — so its keys
 * have to be the window's. It is live only while something is picked and never
 * while focus is in a field, which is what keeps it from eating a keystroke in
 * the chat composer or in the palette's own input.
 */

import type { Row } from "@olai/format"
import { type Accessor, type JSX, onCleanup, onMount } from "solid-js"

import { createFoldReading } from "../fold/reading.ts"
import { createDragging, DraggingProvider } from "../drag/dragging.ts"
import { DropLine } from "../drag/DropLine.tsx"
import { SweepBand } from "../drag/Sweep.tsx"
import { createSweeping } from "../drag/sweeping.ts"
import { isEditingTarget, type SelectAction, selectKey } from "../keys.ts"
import { createSelection, type Selection, SelectionProvider } from "../select/selection.ts"
import { SelectionBar } from "../select/SelectionBar.tsx"
import { createEditor, EditorProvider } from "./editing.tsx"

export function Editable(props: {
  /** What is drawn — half of where `↑`/`↓` go, of where a row that has moved
   *  is found again, and of what a drop can land beside. The other half is what
   *  is FOLDED, which is not a prop because it is not this page's: it belongs
   *  half to the browser and half to the reading (`../fold/reading.ts`), and
   *  all three read it where the tree does. */
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly children: JSX.Element
}) {
  const page = {
    rows: () => props.rows(),
    // What is folded FOR THIS READING rather than what this browser has folded
    // (`../fold/reading.ts`): a filter draws its tree expanded, and three
    // walkers that still saw the collapses would move the caret, span a pick
    // and offer a drop among rows nobody can see. The tree reads the same
    // accessor.
    collapsed: createFoldReading(),
  }
  const selection = createSelection(page)
  const editor = createEditor(page, selection)
  const dragging = createDragging({ ...page, selection })
  const sweeping = createSweeping(selection)

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (selection.rows().length === 0) return
      // Never over a field. The pick is live across the whole window, so a
      // handler that fired while somebody was typing in the composer would be a
      // keystroke they could not get back.
      if (isEditingTarget(event.target)) return
      const action = selectKey(event)
      if (action === null) return
      // `Tab` would otherwise walk the focus out of the outline entirely, and
      // ⌘A would select the page's text under the rows that are picked.
      event.preventDefault()
      BULK[action](selection)
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <SelectionProvider value={selection}>
      <DraggingProvider value={dragging}>
        <EditorProvider editor={editor}>
          {/* `min-h-full` so the box reaches the foot of the pane: the page
              below a short outline is the sweep's largest surface, and a
              wrapper that stopped at the last row would leave a reader nothing
              to press. `data-sweep` is `../drag/sweeping.ts`'s `SWEEP`, spelled
              as a literal for the reason that constant gives (a JSX spread
              would put every attribute of this box on Solid's runtime spread
              path) and held to that name by `../claims.test.ts`. */}
          <div class="min-h-full" data-sweep="" onPointerDown={sweeping.begin}>
            {props.children}
          </div>
          <DropLine landing={dragging.landing()} />
          <SweepBand sweep={sweeping.band()} />
          <SelectionBar />
        </EditorProvider>
      </DraggingProvider>
    </SelectionProvider>
  )
}

/** What each selection key does. A table rather than a chain of `if`s, for the
 *  reason the row editor's own is one: an action added to {@link SelectAction}
 *  and not answered here does not compile. */
const BULK: Record<SelectAction, (selection: Selection) => void> = {
  complete: (selection) => selection.run("complete"),
  in: (selection) => selection.run("in"),
  out: (selection) => selection.run("out"),
  up: (selection) => selection.run("up"),
  down: (selection) => selection.run("down"),
  growUp: (selection) => selection.grow(-1),
  growDown: (selection) => selection.grow(1),
  all: (selection) => selection.widen(),
  clear: (selection) => selection.clear(),
}
