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
 * holding the BULLET specifically — holding anywhere else on the row still
 * does, which is nearly all of it — and that is the trade taken, because two
 * gestures cannot both own one press and the menu has a row to be reached from
 * while a handle has only itself.
 */

import type { Row } from "@olai/format"
import type { Edit } from "@olai/surface"
import { type Accessor, createContext, createSignal, onCleanup, useContext } from "solid-js"

import { flatten } from "../edit/order.ts"
import type { Said } from "../edit/undoing.ts"
import { useUndo } from "../edit/undoing.ts"
import { longPressOn } from "../longPress.ts"
import { createDrags, TRAVEL_PX } from "../pointer.ts"
import { beneath, chainOf, depthOf } from "../select/range.ts"
import { applyingAll } from "../writes.ts"
import { type Aim, type Aimed, aimAt } from "./aim.ts"
import { type Field, useFields } from "./fields.ts"
import { measureBox, measureLines, paneOf } from "./lines.ts"
import type { Landing, Placed } from "./plan.ts"

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
  const [moving, setMoving] = createSignal<ReadonlySet<string>>(new Set())
  const [aim, setAim] = createSignal<Aim | null>(null)
  const fields = useFields()
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
   * EVERY PAGE ON SCREEN, measured — and in each of them, every row a drop may
   * land beside.
   *
   * ONE PASS OVER THE WORKSPACE rather than over this page, which is the whole
   * of what a second pane changed here: the pointer picks the page
   * (`./aim.ts`), so the page cannot be assumed before the pointer has moved.
   * Each is measured against ITS OWN PANE — a `Row.key` is a chain from the
   * roots of its page, so two panes on one file draw two sets of lines wearing
   * the same keys, and one sweep of the document would give pane 1's rows pane
   * 0's boxes (`./lines.ts`).
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
   *     that page's own roots. Its ancestry rides on the field instead
   *     (`./fields.ts`'s `within`), and the two are read as one chain. What the
   *     ids alone cost is that a mirror of a carried node is excluded wherever
   *     it is drawn, which is the more honest answer anyway: dropping a node
   *     inside a second placement of itself is the loop the ops layer refuses.
   *   - **Every row of another FILE.** An outline is an independent tree and a
   *     parent is same-file by the format, so a row from `house.olai` has no
   *     landing among the rows a mirror of `garden.olai` expands — they are
   *     drawn in this tree and they are records of that one. Dropping between
   *     two of them would name a parent in the wrong file and be refused after
   *     the line had promised it (review, 2026-08-14).
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
  const measure = (carried: ReadonlyArray<Row>): ReadonlyArray<Aimed> => {
    // The file the drag is ABOUT — the carried rows', not any page's, which is
    // what makes a mirror's children draggable among themselves. A pick that
    // spans two files has no one answer; the rows of the other file are then
    // left out, and the ops layer refuses them by name on the bar, which is the
    // same way every other half-legal run ends here.
    const file = carried[0]?.at.file
    if (file === undefined) return []
    const held = new Set(carried.map((one) => one.at.node.id))
    return fields.all().flatMap((field): ReadonlyArray<Aimed> => {
      const drawn = field.element()
      if (drawn === undefined) return []
      const pane = paneOf(drawn)
      const box = measureBox(pane)
      if (box === null) return []
      return [{ file: field.file, box, placed: placeable(field, pane, file, held) }]
    })
  }

  /** One page's rows, as places a drop may land beside. The reading above,
   *  applied to one field — separate because the walk is per page and the
   *  facts it is filtered against are per gesture. */
  const placeable = (
    field: Field,
    pane: Element,
    file: string,
    held: ReadonlySet<string>,
  ): ReadonlyArray<Placed> => {
    const lines = new Map(measureLines(pane).map((line) => [line.key, line]))
    const inside = (key: string): boolean =>
      [...field.within, ...chainOf(key)].some((id) => held.has(id))
    return flatten(field.rows(), field.collapsed()).flatMap((row): ReadonlyArray<Placed> => {
      if (row.at.file !== file || inside(row.key)) return []
      const line = lines.get(row.key)
      if (line === undefined) return []
      const shows = row.kind === "node" || row.kind === "mirror" ? row.shows : undefined
      return [{
        ...line,
        id: row.at.node.id,
        parent: row.at.node.parent ?? null,
        // A placement is not a parent; the node it SHOWS is, and only when that
        // node is in this file and is not itself in the air. Same rule, same
        // reason, as `move in`'s — with the loop the second pane can draw
        // (a mirror of what the hand is holding) closed by the same field.
        into: shows !== undefined && shows.file === file && !held.has(shows.node.id)
          ? shows.node.id
          : null,
        depth: depthOf(row.key),
      }]
    })
  }

  /**
   * The page STOPS SCROLLING under a finger that has been held, and starts
   * again the moment the row is put down.
   *
   * Claimed here rather than as `touch-action: none` on the handle, and the
   * difference is the whole of what makes this honest: a style is in force from
   * the instant a finger lands, so a thumb that happened to start its flick on
   * a bullet could not scroll the page at all — a 28px-wide dead strip running
   * down the left of every outline. A non-passive `touchmove` listener is in
   * force from the DEADLINE, which is a moment the browser has already agreed
   * is not a scroll (a finger that had drifted would have taken the deadline
   * with it, and one the browser took to scroll with would have cancelled the
   * pointer). So the page keeps every gesture it had, and this claims exactly
   * the one that is left.
   */
  const stopScrolling = (event: TouchEvent): void => event.preventDefault()
  const claimScroll = (): void =>
    window.addEventListener("touchmove", stopScrolling, { passive: false })
  const freeScroll = (): void => window.removeEventListener("touchmove", stopScrolling)
  // A row dragged off the page mid-gesture would otherwise leave the whole
  // document unable to scroll, which is the one failure here nobody could
  // recover from without a reload.
  onCleanup(freeScroll)

  /** This page's gestures: one at a time, and whatever is in flight is ended
   *  with the page that made it (`../pointer.ts`). */
  const drags = createDrags()

  /**
   * The gesture proper, once something has decided it IS one.
   *
   * `held` is WHICH of the two decided — a finger's DEADLINE (the row is
   * already lifted, and the page has stopped moving under it) rather than a
   * pointer's THRESHOLD (the row lifts on the fourth pixel, and a press that
   * never travels was the bullet's own link all along). Everything after that
   * moment is identical, which is why this is one function rather than two that
   * would drift.
   */
  const gesture = (from: PointerEvent, row: Row, held: boolean) => {
    /** What this gesture is carrying, decided when it becomes a drag rather
     *  than at the press: a press that turns out to be a click must not have
     *  cleared the selection on its way past. */
    let carried: ReadonlyArray<Row> = []
    let pages: ReadonlyArray<Aimed> = []
    /** The file the rows in the air came from — a fact about the GESTURE, and
     *  what a page with none of it is refused BY name (`./aim.ts`). */
    let carriedFrom = ""

    const lift = () => {
      travelled = true
      const picked = page.selection.keys()
      carried = picked.has(row.key) ? page.selection.rows() : [row]
      if (!picked.has(row.key)) page.selection.clear()
      setMoving(new Set(carried.map((one) => one.key)))
      carriedFrom = carried[0]?.at.file ?? ""
      pages = measure(carried)
    }

    if (held) {
      lift()
      claimScroll()
    }
    drags.start(from, {
      // No threshold at all once a finger has been HELD: the deadline it met is
      // what told the two gestures apart, so the first pixel after it is
      // already the drag. Asking for four more would be asking a person who has
      // just felt the row lift to prove they meant it.
      threshold: held ? 0 : TRAVEL_PX,
      onStart: held ? undefined : lift,
      // ON THE PAGE, which is where the rows were measured — and which moves
      // under a pointer held near an edge of the window, with no `pointermove`
      // behind it (`../pointer.ts`, `../autoscroll.ts`). Without that the reach
      // of a drag is whatever was visible when the press landed, which on an
      // outline is most of the gesture missing.
      onPage: (x, y) => setAim(aimAt(pages, carriedFrom, x, y)),
      onEnd: (up) => {
        if (held) freeScroll()
        // A CANCELLED gesture is not a drop, and the difference is the whole
        // reason the primitive answers with `null` rather than with the last
        // move: a pointer taken away mid-drag has not chosen anything.
        const target = up === null ? null : aim()
        setMoving(new Set<string>())
        setAim(null)
        if (target === null || carried.length === 0) return
        // A REFUSAL IS SAID RATHER THAN SWALLOWED, and it is said in the place
        // every other refused gesture over these rows says its piece: the bar
        // (`../select/SelectionBar.tsx`), which draws for a sentence with no
        // pick behind it and does not fade. The words are the ones the face
        // over the pane was already showing — one spelling, so the answer
        // cannot change at the moment the hand lets go.
        if (target.kind === "refused") {
          page.selection.say({ tone: "alarm", text: target.refusal.why })
          return
        }
        void drop(target.landing, carried)
      },
    })
  }

  /**
   * The finger's deadline, and the row it is being held over.
   *
   * ONE watcher for the page rather than one per row: what it is watching is
   * whatever was pressed last, and two fingers on two bullets is a pinch the
   * gesture already refuses (`../longPress.ts`). The PRESS comes back with the
   * deadline — neither the timer nor the platform's own `contextmenu` carries
   * one — so the only thing kept beside the watcher is which row it was on.
   */
  let over: Row | undefined
  const watcher = longPressOn((from) => {
    if (over !== undefined) gesture(from, over, true)
  })

  const grab = (event: PointerEvent, row: Row) => {
    // The secondary button opens a context menu; a drag is the primary one's.
    if (event.button !== 0) return
    // Every press clears it, and nothing else does — see the field's own note.
    travelled = false
    if (event.pointerType === "touch") {
      over = row
      watcher.onPointerDown(event)
      return
    }
    gesture(event, row, false)
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
    aim,
    grab,
    heldMenu: watcher.onContextMenu,
    dragged: () => travelled,
  }
}
