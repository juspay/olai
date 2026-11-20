import { usePaneId, useShown } from "olai-plugin-navigation/routing"
import { createEffect, createSignal } from "solid-js"
import { carriedText } from "olai-plugin-chat/carry"
import { documentBox } from "@olai/web/client/carry.ts"
import { landings } from "../landings.ts"
import { placeable } from "../drag/places.ts"
import { planDrop } from "../drag/plan.ts"
import type { Landing } from "../drag/plan.ts"
import { anchorFor, nodeText } from "../drag/landing.ts"
import { applying } from "../writes.ts"
import { useUndo } from "./undoing.ts"
/**
 * THE ORDER THE FIVE ARE MADE IN IS THE DEPENDENCY between them, and it is
 * one way: the selection and the move picker know nothing about the caret, the
 * editor hands the caret over to them for the four keys that leave a row (three
 * that pick, and `⌘⇧M`, which opens the picker), the drag reads the selection
 * to find out whether it is carrying one row or all of them, and the sweep
 * writes a run into it.
 */

import { printAddress, type Row } from "@olai/format"
import { type Accessor, createMemo, type JSX, onCleanup, onMount, Show } from "solid-js"

import { createFoldReading } from "../fold/reading.ts"
import { Aiming } from "../drag/Aiming.tsx"
import { createDragging, DraggingProvider } from "../drag/dragging.ts"
import { useFields } from "../drag/fields.ts"
import { SweepBand } from "../drag/Sweep.tsx"
import { createSweeping } from "../drag/sweeping.ts"
import { isEditingTarget, type SelectAction, selectKey } from "@olai/web/client/keys.ts"
import { createMoving, MovingProvider } from "../move/moving.tsx"
import { useFrames } from "../reading.tsx"
import { useGo, useHere, useRouter } from "olai-plugin-navigation/routing"
import { panesOf } from "olai-plugin-navigation/workspace"
import { atFile, zoomNode } from "olai-plugin-navigation/routes"
import { createSelection, type Selection, SelectionProvider } from "../select/selection.ts"
import { SelectionBar } from "../select/SelectionBar.tsx"
import { createEditor, EditorProvider, type Zooming } from "./editing.tsx"
import { useEditorMemory } from "./memory.ts"

interface EditableProps {
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly file: string
  readonly within: ReadonlyArray<string>
  readonly children: JSX.Element
}

export function Editable(props: EditableProps) {
  return <EditablePage {...props} />
}

function EditablePage(props: EditableProps) {
  const shown = useShown()
  const here = useHere()
  const router = useRouter()
  const memory = useEditorMemory()
  const page = {
    rows: () => props.rows(),
    collapsed: createFoldReading(),
    frames: useFrames(),
  }
  const selection = createSelection(page, memory.selection)
  const moving = createMoving(page, (row) => editor.open(row, "title"), memory.moving)
  const go = useGo()
  const zooming: Zooming = {
    into: (id) => go(zoomNode(id)),
    get out() {
      if (props.within.length === 0) return undefined
      return () =>
        go(
          props.within.length >= 2
            ? zoomNode(props.within[props.within.length - 2]!)
            : atFile(props.file),
        )
    },
  }
  const editor = createEditor(page, selection, moving, zooming, memory)
  const dragging = createDragging({ selection })
  const sweeping = createSweeping(selection, () => surface)

  let surface: HTMLDivElement | undefined
  const field = {
    get file() {
      return props.file
    },
    get within() {
      return props.within
    },
    rows: page.rows,
    collapsed: page.collapsed,
    element: () => surface,
  }
  useFields().join(field)
  const undo = useUndo()
  const [foreign, setForeign] = createSignal<{ readonly kind: "drop"; readonly landing: Landing } | null>(null)
  createEffect(() => {
    const table = landings()
    if (!table) return
    let placed: ReturnType<typeof placeable> | undefined
    const aim = (x: number, y: number) => surface === undefined ? null : planDrop(placed ??= placeable(field, surface, props.file, new Set()), x, y)
    onCleanup(table.register({
      lift: value => carriedText(value) ? documentBox(surface) : null,
      aim: (_, x, y) => { const landing = aim(x, y); setForeign(landing && { kind: "drop", landing }) },
      leave: () => { placed = undefined; setForeign(null) },
      drop: async value => {
        if (!carriedText(value)) return null
        const landing = foreign()?.landing
        if (!landing) return null
        const said = await applying({ verb: "add", at: anchorFor(landing, props.file), ...nodeText(value.text) }, undo.record)
        selection.say(said ?? null)
        return null
      },
    }))
  })

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!shown()) return
      if (!event.defaultPrevented && event.key === "Escape"
        && router.focusIndex() === here()
        && (event.target === document.body || event.target === document.documentElement)
        && editor.draft()?.kind === "row" && editor.where().place === null) {
        event.preventDefault()
        editor.press("cancel")
        return
      }
      if ((router as import("olai-plugin-navigation/contract").Navigation).info(here())?.pending === true) return
      if (selection.rows().length === 0) return
      if (isEditingTarget(event.target)) return
      const action = selectKey(event)
      if (action === null) return
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
            <div ref={surface} class="grow" data-sweep="" onPointerDown={sweeping.begin}>
              {props.children}
            </div>
            <Aiming aim={dragging.aim() ?? foreign()} />
            <SweepBand sweep={sweeping.band()} />
            <SelectionBar />
          </EditorProvider>
        </MovingProvider>
      </DraggingProvider>
    </SelectionProvider>
  )
}

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
