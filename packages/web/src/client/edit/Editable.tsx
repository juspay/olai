/**
 * A page whose rows can be typed in, picked and moved.
 *
 * The LIFETIME of all three is a page. An editor's draft state survives a
 * rebuild of that same page; its listeners and readers are recreated here.
 * That is what this
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
 * THE ORDER THE FIVE ARE MADE IN IS THE DEPENDENCY between them, and it is
 * one way: the selection and the move picker know nothing about the caret, the
 * editor hands the caret over to them for the four keys that leave a row (three
 * that pick, and `⌘⇧M`, which opens the picker), the drag reads the selection
 * to find out whether it is carrying one row or all of them, and the sweep
 * writes a run into it.
 *
 * THE PICKER IS THE PAGE'S for the reason the selection is, plus one of its
 * own: the key that opens it is pressed in the row editor and the panel is
 * drawn in a row, and those two components have no path between them
 * (`../move/moving.tsx`). It also has to survive the write it sends — a moved
 * row is drawn somewhere else, and the sentence about the move belongs under it
 * there.
 *
 * THE DRAG IS THE ONE OF THE FOUR THAT LOOKS OUTWARD, and that is what a split
 * workspace changed (#225): a row picked up here may be released over the pane
 * beside this one, so where a drop can LAND is the workspace's question rather
 * than this page's. What this component does about it is join the register of
 * pages a drag can aim at (`../drag/fields.ts`) — this page's rows, its file,
 * and the box they are drawn in — and go on owning nothing but its own. The
 * gesture's own lifetime is still exactly a page: it is created here, it dies
 * here, and what it carries is decided by the selection on THIS side.
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

import { printAddress, type Row } from "@olai/format"
import { type Accessor, createMemo, type JSX, onCleanup, onMount, Show } from "solid-js"

import { createFoldReading } from "../fold/reading.ts"
import { Aiming } from "../drag/Aiming.tsx"
import { createDragging, DraggingProvider } from "../drag/dragging.ts"
import { useFields } from "../drag/fields.ts"
import { SweepBand } from "../drag/Sweep.tsx"
import { createSweeping } from "../drag/sweeping.ts"
import { isEditingTarget, type SelectAction, selectKey } from "../keys.ts"
import { createMoving, MovingProvider } from "../move/moving.tsx"
import { useFrames } from "../reading.tsx"
import { useGo, useHere, useRouter } from "../router.tsx"
import { panesOf } from "../workspace.ts"
import { atFile, atNode } from "../routes.ts"
import { createSelection, type Selection, SelectionProvider } from "../select/selection.ts"
import { SelectionBar } from "../select/SelectionBar.tsx"
import { createEditor, EditorProvider, type Zooming } from "./editing.tsx"
import { keepEditor, takeEditor } from "./memory.ts"

interface EditableProps {
  /** What is drawn — half of where `↑`/`↓` go, of where a row that has moved
   *  is found again, and of what a drop can land beside. The other half is what
   *  is FOLDED, which is not a prop because it is not this page's: it belongs
   *  half to the browser and half to the reading (`../fold/reading.ts`), and
   *  all three read it where the tree does. */
  readonly rows: Accessor<ReadonlyArray<Row>>
  /** The file this page is OF — the outline it draws, or the file its zoomed
   *  node lives in. Not derivable from the rows: an empty page has none, and a
   *  page whose rows all come through a mirror has the wrong one. What it is
   *  FOR is a drag from another pane, which has to be told which file said no
   *  (`../drag/fields.ts`). */
  readonly file: string
  /** The nodes this page is drawn INSIDE, its own zoomed node last — and `[]`
   *  for a whole outline, which is an ANSWER rather than an absence and is why
   *  it is not optional: an outline is inside nothing, and a page that forgot
   *  to say what it is inside would silently offer a drop into the branch it is
   *  a zoom of. The ancestry a `Row.key` here cannot spell, and therefore the
   *  half of "a branch is never offered a place inside itself" that only a
   *  second pane can ask for. */
  readonly within: ReadonlyArray<string>
  readonly children: JSX.Element
}

export function Editable(props: EditableProps) {
  const here = useHere()
  const identity = createMemo(() => JSON.stringify([here(), props.file, props.within]))
  return <Show when={identity()} keyed>{(_identity) => <EditablePage {...props} />}</Show>
}

function EditablePage(props: EditableProps) {
  const pane = useHere()()
  const router = useRouter()
  const route = panesOf(router.workspace())[pane]?.route
  const identity = JSON.stringify([props.file, props.within])
  const memory = takeEditor(pane, identity, route)
  onCleanup(() => {
    const now = panesOf(router.workspace())[pane]?.route
    if (now?.kind === "at" && route?.kind === "at"
      && (now.address === null ? null : printAddress(now.address))
        === (route.address === null ? null : printAddress(route.address))) {
      keepEditor(pane, identity, now, memory)
    }
  })
  const page = {
    rows: () => props.rows(),
    // What is folded FOR THIS READING rather than what this browser has folded
    // (`../fold/reading.ts`): a filter draws its tree expanded, and three
    // walkers that still saw the collapses would move the caret, span a pick
    // and offer a drop among rows nobody can see. The tree reads the same
    // accessor.
    collapsed: createFoldReading(),
    // …and how many frames this pane's reading has moved on, which is the ONE
    // thing the editor waits for that neither of the two above can say: the
    // rows arrive on a subscription whose value is reconciled in place, so
    // "the frame that redraws this row landed" is a count rather than a new
    // array (`../reading.tsx`'s `useFrames`).
    frames: useFrames(),
  }
  const selection = createSelection(page, memory.selection)
  // The two know each other one way round each: the editor's `⌘⇧M` opens the
  // picker, and the picker hands the caret back to the row when it is
  // dismissed. The second is a thunk rather than a value because the editor is
  // made on the next line — a keyboard door that left focus on `<body>` is the
  // gap both reviews of #245 named, and this is the one line that closes it.
  const moving = createMoving(page, (row) => editor.open(row, "title"), memory.moving)
  /**
   * The two ZOOM keys' destinations — the editor knows how to leave a row
   * and not where that goes, so the ROUTES are spelled here: the node a
   * zoom-in names is an id the editor already holds, and "the page above"
   * is `within`'s one crumb short of the subject — or the file itself. On a
   * whole outline there IS none, so `out` is left ABSENT — a GETTER, so the
   * absence is answered when the key is pressed rather than frozen at setup.
   */
  const go = useGo()
  const zooming: Zooming = {
    into: (id) => go(atNode(id)),
    get out() {
      if (props.within.length === 0) return undefined
      return () =>
        go(
          props.within.length >= 2
            ? atNode(props.within[props.within.length - 2]!)
            : atFile(props.file),
        )
    },
  }
  const editor = createEditor(page, selection, moving, zooming, memory)
  const dragging = createDragging({ selection })
  const sweeping = createSweeping(selection, () => surface)

  /** This page's own box, and what BOTH row gestures measure inside: a `Row.key`
   *  is a chain from the roots of ITS page, so it is unique in one and not
   *  across two, and a measurement of the whole document would hand this page's
   *  answer the next page's boxes (`../drag/lines.ts`). */
  let surface: HTMLDivElement | undefined
  // JOINED FOR AS LONG AS THIS PAGE LIVES, which is what makes the registry a
  // reading of what is on screen rather than a history of it: a drag begun in
  // any pane measures the pages that are drawn NOW, off the accessors below
  // rather than off a snapshot taken at mount.
  useFields().join({
    get file() {
      return props.file
    },
    get within() {
      return props.within
    },
    rows: page.rows,
    collapsed: page.collapsed,
    element: () => surface,
  })

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
        <MovingProvider value={moving}>
          <EditorProvider editor={editor}>
            {/* `grow` so the box reaches the foot of the pane: the page below a
                short outline is the sweep's largest surface, and a wrapper that
                stopped at the last row would leave a reader nothing to press.

                IT WAS `min-h-full`, and that is a CIRCULAR percentage: the pane
                is auto-height, so `100%` resolved against a height the pane had
                already computed WITHOUT this box, and the box came out exactly
                one FilterBar too tall — overflowing the pane by that much. The
                pane used to be a scroll container, which hid it; the moment it
                stopped being one (`../App.tsx` says why, for the sticky section
                headings) those pixels became scrollable overflow on the DOCUMENT,
                and the sidebar's own sticky offset was clamped by them — a
                directory pinned six pixels above the header, which is what the
                suite caught. A flex fill asks the same question with no
                circularity in it, so the pane is now a column (`../App.tsx`).

                `data-sweep` is `../drag/sweeping.ts`'s `SWEEP`, spelled as a
                literal for the reason that constant gives (a JSX spread would put
                every attribute of this box on Solid's runtime spread path) and
                held to that name by `../claims.test.ts`. */}
            <div ref={surface} class="grow" data-sweep="" onPointerDown={sweeping.begin}>
              {props.children}
            </div>
            <Aiming aim={dragging.aim()} />
            <SweepBand sweep={sweeping.band()} />
            <SelectionBar />
          </EditorProvider>
        </MovingProvider>
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
