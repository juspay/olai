/**
 * Dragging a row, as a gesture: what is being carried, where it would land, and
 * the one write that puts it there.
 *
 * **THE GESTURE ITSELF IS NOT HERE.** Window listeners, the teardown, the
 * text-selection guard and the threshold that tells a drag from a click are one
 * mechanism shared with the panel edges (`../pointer.ts`, which also holds the
 * argument for pointer events over HTML5 drag-and-drop). What is left in this
 * file is the only part that is about an OUTLINE: what a gesture is carrying,
 * where the rows are, and the write a release makes.
 *
 * **A drag starts only after the pointer has moved.** The bullet is a link to
 * the node's own page, so a press that never travels must still be that
 * navigation; the threshold is what tells the two apart, and the click that
 * follows a real drag is swallowed ({@link Dragging.dragged}).
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
import { drag as pointerDrag } from "../pointer.ts"
import { beneath, depthOf } from "../select/range.ts"
import { applyingAll } from "../writes.ts"
import { type Landing, type Placed, planDrop } from "./plan.ts"

/** How far the pointer must travel before a press becomes a drag rather than a
 *  click on the bullet's link. Four pixels is the number a hand resting on a
 *  trackpad produces without meaning to. */
const THRESHOLD = 4

/** The attribute a row's LINE carries so a drag can measure it. On the line and
 *  not on the `<li>`, because an item's box contains every row nested under it
 *  and the gap arithmetic is about the lines a reader sees. */
export const ROW_KEY = "data-row-key"

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
  /**
   * Did the gesture that ended most recently TRAVEL? Not a signal: nothing
   * draws it, and its one reader is a click handler.
   *
   * Cleared by the next PRESS rather than by the read, which is the only
   * spelling that is true for both the click that follows a drag and the one
   * that does not. A `click` fires on the nearest common ancestor of the press
   * and the release, so a row dragged and dropped somewhere else produces no
   * click on the bullet at all — and a flag cleared on read would still be set
   * when the reader next pressed a bullet, swallowing the navigation of a
   * gesture that never travelled. Every click on a handle is preceded by a
   * press on that handle, so clearing there covers it exactly.
   */
  let travelled = false

  /**
   * Every row a drop may land beside, measured.
   *
   * TWO THINGS ARE LEFT OUT, and they are the same kind of fact: a place the
   * write could not go.
   *
   *   - **The rows being carried, and everything under them.** What makes "you
   *     cannot drop a branch inside itself" true by construction rather than by
   *     a guard — and it leaves a tree behind, since removing whole subtrees
   *     from a drawn tree leaves one, so the planner's walk back for an ancestor
   *     always finds a row.
   *   - **Every row of another FILE.** An outline is an independent tree and a
   *     parent is same-file by the format, so a row from `house.jsonl` has no
   *     landing among the rows a mirror of `garden.jsonl` expands — they are
   *     drawn in this tree and they are records of that one. Dropping between
   *     two of them would name a parent in the wrong file and be refused after
   *     the line had promised it (review, 2026-08-14).
   *
   * Read the second one the other way round and it is a FEATURE rather than a
   * fence: dragging one of a mirror's expanded children measures the rows of
   * ITS file, which are exactly its real siblings — so reordering a node inside
   * a mirror works, and lands in the file that node lives in.
   *
   * What may be dropped INTO is the other half, and it rides on each row
   * ({@link Placed.into}).
   */
  const measure = (carried: ReadonlyArray<Row>): ReadonlyArray<Placed> => {
    const lines = new Map<string, Element>()
    for (const line of document.querySelectorAll(`[${ROW_KEY}]`)) {
      const key = line.getAttribute(ROW_KEY)
      if (key !== null) lines.set(key, line)
    }
    const keys = new Set(carried.map((one) => one.key))
    // The file the drag is ABOUT — the carried rows', not the page's, which is
    // what makes a mirror's children draggable among themselves. A pick that
    // spans two files has no one answer; the rows of the other file are then
    // left out, and the ops layer refuses them by name on the bar, which is the
    // same way every other half-legal run ends here.
    const file = carried[0]?.at.file
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    return flatten(page.rows(), page.collapsed()).flatMap((row): ReadonlyArray<Placed> => {
      if (row.at.file !== file || beneath(keys, row.key)) return []
      const line = lines.get(row.key)
      if (line === undefined) return []
      const box = line.getBoundingClientRect()
      const shows = row.kind === "node" || row.kind === "mirror" ? row.shows : undefined
      return [{
        key: row.key,
        id: row.at.node.id,
        parent: row.at.node.parent ?? null,
        // A placement is not a parent; the node it SHOWS is, and only when that
        // node is in this file. Same rule, same reason, as `move in`'s.
        into: shows !== undefined && shows.file === file ? shows.node.id : null,
        depth: depthOf(row.key),
        top: box.top + scrollY,
        bottom: box.bottom + scrollY,
        left: box.left + scrollX,
        right: box.right + scrollX,
      }]
    })
  }

  const grab = (event: PointerEvent, row: Row) => {
    // The secondary button opens a context menu; a drag is the primary one's.
    if (event.button !== 0) return
    // Every press clears it, and nothing else does — see the field's own note.
    travelled = false
    /** What this gesture is carrying, decided when it becomes a drag rather
     *  than at the press: a press that turns out to be a click must not have
     *  cleared the selection on its way past. */
    let carried: ReadonlyArray<Row> = []
    let placed: ReadonlyArray<Placed> = []

    pointerDrag(event, {
      threshold: THRESHOLD,
      onStart: () => {
        travelled = true
        const picked = page.selection.keys()
        carried = picked.has(row.key) ? page.selection.rows() : [row]
        if (!picked.has(row.key)) page.selection.clear()
        setMoving(new Set(carried.map((one) => one.key)))
        placed = measure(carried)
      },
      onMove: (move) => setLanding(planDrop(placed, move.pageX, move.pageY)),
      onEnd: (up) => {
        // A CANCELLED gesture is not a drop, and the difference is the whole
        // reason the primitive answers with `null` rather than with the last
        // move: a pointer taken away mid-drag has not chosen anything.
        const target = up === null ? null : landing()
        setMoving(new Set<string>())
        setLanding(null)
        if (target === null || carried.length === 0) return
        void drop(target, carried)
      },
    })
  }

  /**
   * The write: one `place` per row, each after the one before it, so a run of
   * rows lands in the order it was picked up in.
   *
   * The id is the ROW's own record — a placement moves as the placement it is,
   * which is the rule every `move` in this editor follows and the opposite of
   * the rule a mark follows.
   */
  const drop = async (target: Landing, carried: ReadonlyArray<Row>): Promise<void> => {
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
    carrying: (key) => moving().size > 0 && beneath(moving(), key),
    landing,
    grab,
    dragged: () => travelled,
  }
}
