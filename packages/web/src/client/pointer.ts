/**
 * A POINTER DRAG: from a press, moves until it ends — and nothing about what
 * is being dragged.
 *
 * Two things in this client drag with a pointer, and they have nothing else in
 * common: a panel edge that maps a delta onto a width (`./layout/resize.ts`)
 * and a row that maps a position onto a placement in the outline
 * (`./drag/dragging.ts`). What they SHARE is entirely the plumbing below —
 * window listeners rather than the element's (a pointer that leaves the handle
 * is still dragging it), a teardown that runs on every way a gesture can end,
 * the text-selection guard, and telling a drag from a click. That plumbing was
 * written once for the panel edges and was about to be written a second time,
 * which is the moment it becomes a thing rather than a habit.
 *
 * **The threshold is here rather than at one call site**, and that is the one
 * piece of judgment this module holds: some handles are ONLY handles (a panel
 * edge, where the first pixel is the gesture) and some are also something else
 * (an outline bullet, which is a link to that node's page). Telling those apart
 * is "has the pointer travelled far enough to mean it", which is the same
 * question either way and is answered here so that a caller cannot answer it
 * differently — {@link Gesture.onStart} fires once, when it has.
 *
 * WHY NOT HTML5 DRAG-AND-DROP, for the consumer that could have used it: that
 * API owns the ghost image, keeps its data store protected until the drop, and
 * reports the ELEMENT under the cursor. A width and a placement are both
 * computed from coordinates against boxes this app measured itself, so all
 * three of those are things to work around rather than things to use.
 *
 * WHY NOT A LIBRARY: what is left after the paragraphs above is thirty lines of
 * `addEventListener`, and the SolidJS drag libraries in reach own a sortable
 * LIST — flat, one container, no depth — which is the shape neither consumer
 * has.
 */

export interface Gesture {
  /** The pointer has travelled far enough to be a drag rather than a press.
   *  Called at most once, before the first {@link onMove}. */
  readonly onStart?: (event: PointerEvent) => void
  readonly onMove: (event: PointerEvent) => void
  /** The gesture is over. `null` means it was CANCELLED — the pointer was
   *  taken away rather than released — which is a different answer from "let
   *  go here" and the one a caller must not read as a drop. */
  readonly onEnd: (event: PointerEvent | null) => void
  /** How far the pointer must travel, in pixels, before any of this counts.
   *  `0` (the default) is "immediately", which is what a handle that is only a
   *  handle wants. */
  readonly threshold?: number
}

/**
 * Start listening. Answers with the teardown, for a caller that has to end the
 * gesture itself — a component unmounting mid-drag, a second press arriving
 * before the first was released.
 *
 * It does NOT `preventDefault` the press: whether the default matters is the
 * caller's, and the two consumers disagree. A panel edge suppresses it (the
 * click underneath would toggle something); a bullet must not (a press that
 * turns out to be a click is still the link it always was).
 */
export const drag = (from: PointerEvent, gesture: Gesture): (() => void) => {
  const originX = from.pageX
  const originY = from.pageY
  const threshold = gesture.threshold ?? 0
  let started = false
  // The press must not select the text under it while the pointer travels.
  const selection = document.body.style.userSelect
  document.body.style.userSelect = "none"

  const onMove = (event: PointerEvent) => {
    if (!started) {
      if (Math.hypot(event.pageX - originX, event.pageY - originY) < threshold) return
      started = true
      gesture.onStart?.(event)
    }
    gesture.onMove(event)
  }

  const end = (event: PointerEvent | null) => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
    document.body.style.userSelect = selection
    gesture.onEnd(event)
  }
  const onUp = (event: PointerEvent) => end(event)
  const onCancel = () => end(null)

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onCancel)
  return () => end(null)
}
