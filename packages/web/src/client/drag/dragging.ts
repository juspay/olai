/**
 * Dragging a row, as a gesture: what is being carried, where it would land, and
 * the one write that puts it there.
 *
 * **POINTER EVENTS, not HTML5 drag-and-drop, and it is the same call
 * `../layout/resize.ts` made one control over.** A `dragstart` gesture is the
 * browser's: it owns the ghost image, it keeps its data store protected until
 * the drop, and it fires `dragover` at whatever element is under the cursor.
 * What an outline needs is none of that — the drop target is a GAP between two
 * lines and a depth within it, computed from coordinates (`./plan.ts`), and the
 * affordance is a line this app draws. Pointer capture gives exactly that, and
 * it is what Workflowy's own gesture feels like. The other reason is a rule
 * rather than a preference: HACKING says to reach for the SolidJS ecosystem
 * rather than hand-roll, and every drag library in it owns a sortable LIST —
 * flat, one container, no depth — which is the shape an outline is not.
 *
 * **A drag starts only after the pointer has moved.** The bullet is a link to
 * the node's own page, so a press that never travels must still be that
 * navigation; the threshold below is what tells the two apart, and the click
 * that follows a real drag is swallowed ({@link Dragging.dragged}).
 *
 * **The rows are measured ONCE, when the drag begins, in DOCUMENT
 * coordinates.** Nothing is optimistic here, so nothing on screen moves while a
 * row is being carried — the tree redraws when the file says so, which is after
 * the drop. Measuring per pointermove would be a forced layout per frame over
 * every row of the tree for an answer that cannot have changed. Document
 * coordinates rather than viewport ones so the answer survives a scroll, and so
 * the indicator can be positioned absolutely against the page.
 *
 * **What it sends is `place`, which already existed.** A drop names a parent
 * and the sibling to sit after; that is the surface's own verb, minted for an
 * undo (`../../../surface/src/edit.ts`) and correct here for the same reason it
 * was correct there — it is the one placement `Anchor` cannot spell, and it
 * resolves to the `move_node` an agent would send. Drag-drop needed no new wire
 * verb and no new op.
 *
 * **Several rows land as several writes**, each after the one before it, which
 * is what keeps the run in the order it was picked up in (`../writes.ts`).
 */

import type { Row } from "@olai/format"
import type { Edit } from "@olai/surface"
import { type Accessor, createContext, createSignal, useContext } from "solid-js"

import { flatten } from "../edit/order.ts"
import type { Said } from "../edit/undoing.ts"
import { useUndo } from "../edit/undoing.ts"
import { depthOf, inside } from "../select/range.ts"
import { applyingAll } from "../writes.ts"
import { type Drop, FALLBACK_INDENT, indentOf, type Placed, planDrop } from "./plan.ts"

/** How far the pointer must travel before a press becomes a drag rather than a
 *  click on the bullet's link. Four pixels is the number a hand resting on a
 *  trackpad produces without meaning to. */
const THRESHOLD = 4

/** The attribute a row's LINE carries so a drag can measure it. On the line and
 *  not on the `<li>`, because an item's box contains every row nested under it
 *  and the gap arithmetic is about the lines a reader sees. */
export const ROW_KEY = "data-row-key"

/** Where the indicator goes, in document coordinates, and the placement it is
 *  promising. */
export interface Landing {
  readonly drop: Drop
  readonly top: number
  readonly left: number
  readonly width: number
}

export interface Dragging {
  /** Is this place in the air — either picked up, or drawn under something
   *  that was? A subtree moves whole, so the whole of it fades: a branch that
   *  lifted while its children stayed solid would be saying the children are
   *  staying behind, which is the one thing this gesture never does. */
  readonly carrying: (key: string) => boolean
  /** Where they would land right now, or `null` before the threshold is
   *  crossed and after the drop. */
  readonly landing: Accessor<Landing | null>
  /** Begin a gesture on this row. Nothing happens until the pointer moves. */
  readonly grab: (event: PointerEvent, row: Row) => void
  /** Whether the gesture that just ended was a DRAG — read by the bullet, whose
   *  click would otherwise navigate away the instant a drop lands. */
  readonly dragged: () => boolean
}

const DraggingContext = createContext<Dragging>()

/** The page's drag. A throw outside the provider, for the reason `useEditor`
 *  throws: a row drawn outside an editable page is not one anybody can pick up.
 */
export const useDragging = (): Dragging => {
  const dragging = useContext(DraggingContext)
  if (dragging === undefined) throw new Error("a drag consumer outside <Editable>")
  return dragging
}

export const DraggingProvider = DraggingContext.Provider

export const createDragging = (
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
    /** The multi-selection, because a drag that starts on a picked row carries
     *  the whole pick — and a drag that starts anywhere else puts it away,
     *  which is what clicking outside a selection means everywhere. */
    readonly selection: {
      readonly keys: Accessor<ReadonlySet<string>>
      readonly rows: Accessor<ReadonlyArray<Row>>
      readonly clear: () => void
      readonly say: (said: Said | null) => void
    }
  },
): Dragging => {
  const [moving, setMoving] = createSignal<ReadonlySet<string>>(new Set())
  const [landing, setLanding] = createSignal<Landing | null>(null)
  const undo = useUndo()
  /** True from the moment a gesture crosses the threshold until the click it
   *  produced has been swallowed. Not a signal: nothing DRAWS it, and the one
   *  reader is a click handler running in the same task. */
  let travelled = false

  /**
   * Every row a drop may land beside, measured — which is every drawn row
   * except the ones being carried and everything under them.
   *
   * Leaving those out is what makes "you cannot drop a branch inside itself"
   * true by construction rather than by a guard, and it leaves a tree behind:
   * removing whole subtrees from a drawn tree leaves one, so the planner's walk
   * back for an ancestor always finds a row.
   */
  const measure = (carried: ReadonlySet<string>): ReadonlyArray<Placed> => {
    const lines = new Map<string, Element>()
    for (const line of document.querySelectorAll(`[${ROW_KEY}]`)) {
      const key = line.getAttribute(ROW_KEY)
      if (key !== null) lines.set(key, line)
    }
    const away = (key: string): boolean =>
      [...carried].some((held) => key === held || key.startsWith(`${held}/`))
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    return flatten(page.rows(), page.collapsed()).flatMap((row): ReadonlyArray<Placed> => {
      if (away(row.key)) return []
      const line = lines.get(row.key)
      if (line === undefined) return []
      const box = line.getBoundingClientRect()
      return [{
        key: row.key,
        id: row.at.node.id,
        parent: row.at.node.parent ?? null,
        depth: depthOf(row.key),
        top: box.top + scrollY,
        bottom: box.bottom + scrollY,
        left: box.left + scrollX,
        right: box.right + scrollX,
      }]
    })
  }

  /** Where to draw the line for a landing: along the gap it names, offset to
   *  the depth it promises. The rows either side of the gap are what says where
   *  that is on screen — a drop at the end of the list sits under the last row,
   *  and one at the top sits above the first. */
  const drawn = (
    rows: ReadonlyArray<Placed>,
    drop: Drop,
    indent: number,
  ): Landing | null => {
    const above = rows[drop.gap - 1]
    const below = rows[drop.gap]
    const edge = above?.bottom ?? below?.top
    const beside = above ?? below
    if (edge === undefined || beside === undefined) return null
    const origin = beside.left - beside.depth * indent
    const left = origin + drop.depth * indent
    return { drop, top: edge, left, width: Math.max(0, beside.right - left) }
  }

  const grab = (event: PointerEvent, row: Row) => {
    // The secondary button opens a context menu; a drag is the primary one's.
    if (event.button !== 0) return
    const originX = event.pageX
    const originY = event.pageY
    // The press must not select the text under it while the pointer travels.
    const held = document.body.style.userSelect
    /** What this gesture is carrying, decided when it becomes a drag rather
     *  than at the press: a press that turns out to be a click must not have
     *  cleared the selection on its way past. */
    let carried: ReadonlyArray<Row> = []
    let placed: ReadonlyArray<Placed> = []
    let indent = 0
    let began = false

    const begin = () => {
      began = true
      travelled = true
      const picked = page.selection.keys()
      carried = picked.has(row.key) ? page.selection.rows() : [row]
      if (!picked.has(row.key)) page.selection.clear()
      const keys = new Set(carried.map((one) => one.key))
      setMoving(keys)
      placed = measure(keys)
      indent = indentOf(placed) ?? FALLBACK_INDENT
    }

    const onMove = (move: PointerEvent) => {
      if (!began) {
        if (Math.hypot(move.pageX - originX, move.pageY - originY) < THRESHOLD) return
        begin()
      }
      const drop = planDrop(placed, move.pageX, move.pageY)
      setLanding(drop === null ? null : drawn(placed, drop, indent))
    }

    const finish = (up: PointerEvent | null) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
      document.body.style.userSelect = held
      const target = up === null ? null : landing()
      setMoving(new Set<string>())
      setLanding(null)
      if (target === null || carried.length === 0) return
      void drop(target.drop, carried)
    }
    const onUp = (up: PointerEvent) => finish(up)
    const onCancel = () => finish(null)

    document.body.style.userSelect = "none"
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
  }

  /**
   * The write: one `place` per row, each after the one before it, so a run of
   * rows lands in the order it was picked up in.
   *
   * The id is the ROW's own record — a placement moves as the placement it is,
   * which is the rule every `move` in this editor follows and the opposite of
   * the rule a mark follows.
   */
  const drop = async (target: Drop, carried: ReadonlyArray<Row>): Promise<void> => {
    let after = target.after
    const edits: Array<Edit> = []
    for (const row of carried) {
      edits.push({ verb: "place", id: row.at.node.id, parent: target.parent, after })
      after = row.at.node.id
    }
    page.selection.say(await applyingAll(edits, undo.record) ?? null)
  }

  return {
    // The empty case FIRST, and it is not a micro-optimisation: this is asked
    // once per row on every frame the store publishes, and nothing is being
    // dragged in nearly all of them — without it, every row of the tree
    // allocates a copy of an empty set to walk.
    carrying: (key) => {
      const held = moving()
      if (held.size === 0) return false
      return held.has(key) || [...held].some((one) => inside(one, key))
    },
    landing,
    grab,
    dragged: () => {
      const was = travelled
      travelled = false
      return was
    },
  }
}
