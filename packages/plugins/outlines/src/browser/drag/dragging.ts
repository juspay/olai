import { carrySession } from "@olai/web/client/carry.ts"
import { landings } from "../landings.ts"
import type { CarriedNodes } from "../../carry.ts"
/**
 * Dragging a row, as a gesture: what is being carried, where it would land, and
 * the one write that puts it there.
 *
 * **THE GESTURE ITSELF IS NOT HERE.** Window listeners, the teardown, the
 * text-selection guard and the threshold that tells a drag from a click are one
 * mechanism in `@olai/web/client/lifting.ts`, built on the same `pointer.ts`
 * primitive as panel edges. What is left in this
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
 * resolves to the `outlines_move` an agent would send. Drag-drop needed no new wire
 * verb and no new op.
 *
 * **Several rows land as several writes**, each after the one before it, which
 * is what keeps the run in the order it was picked up in (`../writes.ts`).
 *
 * **THE DRAG IS THE WORKSPACE'S, NOT THE PAGE'S**, and that is what a split
 * changed here (#225). A gesture begun on a bullet in pane 0 is released
 * wherever the pointer is, which may be pane 1 — so what it measures is every
 * editable page on screen (`./fields.ts`), each scoped to its own pane, and
 * which one it is aiming at is decided per move (`./aim.ts`). Two panes on the
 * SAME file reconcile for free: the write goes to the file and both trees redraw
 * off the same store, so the row leaves one pane and arrives in the other on the
 * same frame, with nothing here saying so. Two panes on DIFFERENT files cannot
 * be one placement — a parent is same-file by the format — and the pointer is
 * told that over the pane it is over, before it is released, rather than by a
 * write that would fail (or, at the top level, quietly succeed somewhere else).
 *
 * The one thing a drag still keeps to itself is its OWN page's selection: what
 * it is carrying is decided where the press landed, and a run picked in pane 0
 * is pane 0's run wherever it comes down.
 *
 * **A FINGER HOLDS THE BULLET FIRST**, and that is the whole of what touch
 * added. The gesture a phone already owns on a row is the page scrolling under
 * it, so a drag that took the first pixel of travel would cost a reader the
 * ability to read; what claims a gesture honestly on a handset is a LONG PRESS,
 * which is the call `../longPress.ts` already made for the `•••` menu and the
 * same primitive is spent again here. Until the deadline nothing is claimed —
 * the browser keeps the press, a finger that drifts is a scroll and takes the
 * deadline with it — and only a finger that is still there at 500ms lifts the
 * row and stops the page moving under it.
 *
 * THE BULLET, AND NOT THE ROW, is what a finger holds for this, and that is the
 * decision the touch half is: the bullet is already the handle for a mouse and
 * a pen, so it is one handle on three devices rather than a fourth thing to
 * learn. What it costs is that a phone no longer opens the `•••` menu by
 * holding the BULLET specifically — holding the row outside its conversation
 * still does — and that is the trade taken, because two
 * gestures cannot both own one press and the menu has a row to be reached from
 * while a handle has only itself.
 */

import type { Row } from "@olai/format"
import type { Edit } from "@olai/surface"
import { type Accessor, createContext, createSignal, useContext } from "solid-js"

import { placeable } from "./places.ts"
import type { Said } from "@olai/web/client/saying.ts"
import { useUndo } from "../edit/undoing.ts"
import { createLifting } from "@olai/web/client/lifting.ts"
import { applyingAll } from "../writes.ts"
import { airborne, useAir } from "./air.ts"
import { type Aim, type Aimed, aimAt } from "./aim.ts"
import { useFields } from "./fields.ts"
import { measureBox, paneOf } from "./lines.ts"
import type { Landing } from "./plan.ts"

/**
 * The attribute the row's HANDLE wears — the bullet, as something to pick a row
 * up by (`./Handle.tsx`).
 *
 * Here rather than on the component because two other things read it and
 * neither is drawing one: the row's `•••` door, which must not arm its own long
 * press on a press this gesture has claimed (`../menu/door.ts`), and the
 * browser tests. What it marks is a fact about this GESTURE — "a press here is
 * the drag's" — so it belongs with the gesture.
 */
export const HANDLE = "data-handle"

/**
 * WHAT A LIFT DECIDED — the whole of it: the rows in the air, the file they
 * came from, and every page on screen measured for them.
 *
 * ONE value rather than three locals beside each other, because they are one
 * decision made in one place and every pair of them is coupled by a rule the
 * shape can hold instead. A page is measured AGAINST a file (rows of any other
 * are not candidates there); a file is the CARRIED rows' rather than any
 * page's; and "is anything being carried" and "has anything been measured" are
 * the same question asked twice. As three fields they would each need a value
 * meaning "not yet" — an empty array to be length-checked, a `""` no
 * comparison may reach — and three `null`s to keep in step with each other.
 * As one, the gesture has it or it does not.
 *
 * IT IS NOT WHAT FADES, and that is the one thing deliberately left outside.
 * What is in the air is a signal, and the WORKSPACE's rather than this
 * gesture's (`./air.ts`), because every row of every tree reads it on every
 * frame the store publishes and it does not change once the row has lifted;
 * where the row would LAND changes on every pointer move and is read by one
 * component. Folding the two together would re-run the first reader — per row,
 * per frame — for an answer that cannot have changed.
 */
interface Lifted {
  readonly rows: ReadonlyArray<Row>
  readonly from: string
  readonly pages: ReadonlyArray<Aimed>
}

export interface Dragging {
  /** Is this place in the air — either picked up, or drawn under something
   *  that was? A subtree moves whole, so the whole of it fades: a branch that
   *  lifted while its children stayed solid would be saying the children are
   *  staying behind, which is the one thing this gesture never does. */
  readonly carrying: (key: string) => boolean
  /** What the pointer is asking for right now — a landing, or the refusal the
   *  page under it has instead (`./aim.ts`) — and `null` before the threshold
   *  is crossed and after the drop. ONE value rather than two signals, because
   *  a landing and a refusal are two answers to one question and nothing on
   *  screen may show both. */
  readonly aim: Accessor<Aim | null>
  /** Begin a gesture on this row's handle. A mouse or a pen: nothing happens
   *  until the pointer moves. A finger: nothing happens until it has been HELD,
   *  and then the row lifts under it. */
  readonly grab: (event: PointerEvent, row: Row) => void
  /** The platform's OWN long press, answered: prevented while this gesture is
   *  holding a finger, so the text-selection callout does not come up over a
   *  row that is about to lift. Wire as `onContextMenu` on the handle beside
   *  {@link grab}; a right-click with a mouse is untouched (`../longPress.ts`).
   *
   *  Only this half of the watcher is handed out. Its `onPointerDown` is
   *  {@link grab}'s to call — a caller given both could arm the deadline twice
   *  for one press, which is a shape nothing should be able to write. */
  readonly heldMenu: (event: Event) => void
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
    /** The multi-selection, because a drag that starts on a picked row carries
     *  the whole pick — and a drag that starts anywhere else puts it away,
     *  which is what clicking outside a selection means everywhere.
     *
     *  THE ONE THING STILL TAKEN FROM THIS PAGE. What a drop may land beside is
     *  no longer this page's rows but every page's (`./fields.ts`) — a pick is
     *  still made where the press was, and stays there. */
    readonly selection: {
      readonly keys: Accessor<ReadonlySet<string>>
      readonly rows: Accessor<ReadonlyArray<Row>>
      readonly clear: () => void
      readonly say: (said: Said | null) => void
    }
  },
): Dragging => {
  /** What is in the air, which is the WORKSPACE's rather than this page's: the
   *  rows a gesture lifts may be drawn in two panes at once, and a subtree that
   *  faded on one side while standing solid on the other would be the
   *  affordance disagreeing with itself about what is moving (`./air.ts`). */
  const air = useAir()
  const [aim, setAim] = createSignal<Aim | null>(null)
  const fields = useFields()
  const undo = useUndo()

  /**
   * EVERY PAGE ON SCREEN, measured — and in each of them, every row a drop may
   * land beside.
   *
   * ONE PASS OVER THE WORKSPACE rather than over this page, which is the whole
   * of what a second pane changed here: the pointer picks the page
   * (`./aim.ts`), so the page cannot be assumed before the pointer has moved.
   * Each is measured WITHIN ITSELF — a `Row.key` is a chain from the roots of
   * its page, so two panes on one file draw two sets of lines wearing the same
   * keys, and one sweep of the document would give pane 1's rows pane 0's boxes
   * (`./lines.ts`). The scope is the PAGE's own box rather than the pane it
   * sits in, which is the tighter of the two answers and does not rest on there
   * being one page per pane.
   *
   * TWO THINGS ARE LEFT OUT of each page's rows, and they are the same kind of
   * fact: a place the write could not go.
   *
   *   - **The rows being carried, and everything under them.** What makes "you
   *     cannot drop a branch inside itself" true by construction rather than by
   *     a guard — and it leaves a tree behind, since removing whole subtrees
   *     from a drawn tree leaves one, so the planner's walk back for an ancestor
   *     always finds a row.
   *
   *     Asked of the RECORDS in a row's chain rather than of the key's prefix,
   *     and that is the second pane's doing. A prefix is the better answer
   *     within one page — it knows the path as well as the record — but there
   *     is no shared path across two: the branch a pane is ZOOMED INTO is not
   *     drawn there at all, and every row under it wears a key that starts at
   *     that page's own roots. That case is answered ONCE for the whole page
   *     off `./fields.ts`'s `within`, rather than per row, because a page drawn
   *     inside something in the air has no landing anywhere in it. What the ids
   *     alone cost is that a mirror of a carried node is excluded wherever it
   *     is drawn, which is the more honest answer anyway: dropping a node
   *     inside a second placement of itself is the loop the ops layer refuses.
   *     It is also the same reading the FADE now uses (`./air.ts`), so what is
   *     drawn as being in the air and what is refused as a landing cannot come
   *     from two opinions.
   *   - **Every row of another FILE.** A row from `house.olai` has no landing
   *     among the rows a mirror of `garden.olai` expands — they are drawn in
   *     this tree and they are records of that one. That was the format's rule
   *     when it was written (review, 2026-08-14) and it is the GESTURE's now:
   *     `outlines_move` carries a subtree to another outline, so such a drop would
   *     be a legal write — and a legal write is not the same as one a hand
   *     dragging inside one tree meant to make. Sending a row to another
   *     outline is `⌘⇧M`'s, which asks for the destination by name; what a drag
   *     offers stays what the pointer can see it land beside.
   *
   * Read the second one the other way round and it is a FEATURE rather than a
   * fence: dragging one of a mirror's expanded children measures the rows of
   * ITS file, which are exactly its real siblings — so reordering a node inside
   * a mirror works, and lands in the file that node lives in. And a whole PAGE
   * left with nothing is not an error either: it is the refusal `./aim.ts`
   * gives the pointer over it, which is how a cross-file drop says no.
   *
   * What may be dropped INTO is the other half, and it rides on each row
   * ({@link Placed.into}).
   *
   * WHERE the lines are is not asked here: that is one reading of the page
   * (`./lines.ts`), shared with the sweep, and what is left in this file is the
   * only part that is about a PLACEMENT.
   */
  const measure = (rows: ReadonlyArray<Row>): Lifted | null => {
    // The file the drag is ABOUT — the carried rows', not any page's, which is
    // what makes a mirror's children draggable among themselves. A pick that
    // spans two files has no one answer; the rows of the other file are then
    // left out, and the ops layer refuses them by name on the bar, which is the
    // same way every other half-legal run ends here.
    const from = rows[0]?.at.file
    if (from === undefined) return null
    const held = new Set(rows.map((one) => one.at.node.id))
    const pages = fields.all().flatMap((field): ReadonlyArray<Aimed> => {
      const drawn = field.element()
      if (drawn === undefined) return []
      // THE PANE'S box, and it is the one thing here that is a pane's rather
      // than a page's: which COLUMN the pointer is in is a question about the
      // column, and the answer has to cover the whole of it — the chrome above
      // the rows included, since a pointer over a pane's filter bar is over
      // that pane (`./aim.ts`). What is drawn IN it is the page's own, below.
      const box = measureBox(paneOf(drawn))
      if (box === null) return []
      return [{ file: field.file, box, placed: placeable(field, drawn, from, held) }]
    })
    return { rows, from, pages }
  }

  const gesture = createLifting((row: Row) => {
    const picked = page.selection.keys()
    const carried = picked.has(row.key) ? page.selection.rows() : [row]
    if (!picked.has(row.key)) page.selection.clear()
    const lifted = measure(carried)
    if (lifted === null) return null
    air.lift(new Set(carried.map(one => one.at.node.id)))
    // Moving retains outline order. Context chips retain the order picked.
    const ids = [...picked]
      .flatMap(key => carried.filter(one => one.key === key).map(one => one.at.node.id))
      .concat(picked.has(row.key) ? [] : [row.at.node.id])
    const table = landings()
    const receiver = table && carrySession({ kind: "outlines.nodes", ids, file: lifted.from } satisfies CarriedNodes, table)
    return {
      onPage: (x: number, y: number) => {
        setAim(receiver?.aim(x, y) ? null : aimAt(lifted.pages, lifted.from, x, y))
      },
      onEnd: (up: PointerEvent | null) => {
        void receiver?.end(up !== null).then(why => { if (why) page.selection.say({ tone: "alarm", text: why }) })
        const target = up === null ? null : aim()
        air.lift(new Set<string>())
        setAim(null)
        if (target === null) return
        if (target.kind === "refused") {
          page.selection.say({ tone: "alarm", text: target.refusal.why })
          return
        }
        void drop(target.landing, lifted.rows)
      },
    }
  })

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
    // Asked of the WORKSPACE's answer rather than this page's, so a subtree
    // lifted in one pane fades in every pane that draws it — and the empty case
    // is still first, for the reason it always was (`./air.ts`).
    carrying: (key) => airborne(air.held(), key),
    aim,
    grab: gesture.grab,
    heldMenu: gesture.heldMenu,
    dragged: gesture.dragged,
  }
}
