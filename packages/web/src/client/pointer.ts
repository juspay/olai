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
 *
 * THE PAGE KEEPING UP is here for the same reason the threshold is
 * ({@link Gesture.onPage}): it is a paired obligation — feed it, and stop it on
 * every way a gesture can end — and it was about to be wired identically by the
 * two consumers that want it. Opt-in, because the third does not: a panel edge
 * scrolling the outline behind it would be this used by accident.
 */

import { onCleanup } from "solid-js"

import { edgeScrolling } from "./autoscroll.ts"

export interface Gesture {
  /** The pointer has travelled far enough to be a drag rather than a press.
   *  Called at most once, before the first {@link onMove}. */
  readonly onStart?: (event: PointerEvent) => void
  /** The pointer moved. Where it is in the WINDOW, which is what a width is
   *  computed from; a gesture aimed at the page wants {@link onPage} instead. */
  readonly onMove?: (event: PointerEvent) => void
  /**
   * Where the pointer is ON THE PAGE, in document coordinates — and, because
   * asking that is what a gesture aimed at rows does, the page KEEPS UP: held
   * near an edge of the window it scrolls, and this is called again on every
   * frame it moves (`./autoscroll.ts`).
   *
   * It is here rather than in each caller because both gestures that want it
   * were wiring the same two lines, and it is a PAIRED obligation — feed it on
   * every move, and stop it on every way the gesture can end — which is exactly
   * the kind of thing this module took over for the panel edges. Composed here,
   * a caller cannot forget the second half, and the frame loop dies with the
   * gesture rather than with whoever remembered.
   *
   * Absent means the page does not move, which is the right answer for a
   * gesture that is not about the page at all: a panel edge scrolling the
   * outline behind it would be this option used by accident.
   */
  readonly onPage?: (x: number, y: number) => void
  /** The gesture is over. `null` means it was CANCELLED — the pointer was
   *  taken away rather than released — which is a different answer from "let
   *  go here" and the one a caller must not read as a drop. */
  readonly onEnd: (event: PointerEvent | null) => void
  /** How far the pointer must travel, in pixels, before any of this counts.
   *  `0` (the default) is "immediately", which is what a handle that is only a
   *  handle wants; {@link TRAVEL_PX} is what a handle that is also something
   *  else wants. */
  readonly threshold?: number
}

/**
 * How far a pointer must travel before a press on a handle that is ALSO
 * something else counts as a drag. Four pixels is what a hand resting on a
 * trackpad produces without meaning to.
 *
 * Here rather than at the call sites for the reason the threshold itself is
 * here: two gestures over the outline ask the same question of the same kind of
 * handle — a bullet that is a link, a page that is text — and a number each of
 * them spelled for itself is a number they could answer differently. (A panel
 * edge is the other case, and it wants no threshold at all.)
 */
export const TRAVEL_PX = 4

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
  /** Only for a gesture that asked to follow the page. Nothing is scheduled and
   *  nothing is listened for otherwise. */
  const following = gesture.onPage === undefined
    ? undefined
    : edgeScrolling(gesture.onPage)

  const onMove = (event: PointerEvent) => {
    if (!started) {
      if (Math.hypot(event.pageX - originX, event.pageY - originY) < threshold) return
      started = true
      gesture.onStart?.(event)
    }
    gesture.onMove?.(event)
    following?.at(event.clientX, event.clientY)
  }

  const end = (event: PointerEvent | null) => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
    document.body.style.userSelect = selection
    following?.stop()
    gesture.onEnd(event)
  }
  const onUp = (event: PointerEvent) => end(event)
  const onCancel = () => end(null)

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onCancel)
  return () => end(null)
}

/**
 * ONE GESTURE AT A TIME, belonging to whoever made this.
 *
 * {@link drag} answers with its teardown and leaves the caller holding it, and
 * that turned out to be a three-part rule every consumer wrote out for itself:
 * keep the handle, `onCleanup` it, and clear it when the gesture ends. The
 * parts are separable — forget the third and a stale teardown cancels a gesture
 * that already finished — and forgetting the second leaks a window listener set
 * and, now, a frame loop past the page that made them. That is the same shape
 * as {@link Gesture.onPage}, and it belongs in the same place.
 *
 * It cannot be {@link drag}'s own `onCleanup`: a drag begins in an EVENT
 * HANDLER, which in Solid runs under no owner at all, so a cleanup registered
 * there would be registered against nothing. So the owner is captured where
 * there is one — call this in the component that will start the gestures — and
 * spent at the press.
 *
 * A second press while one is in flight ENDS the first, as a cancellation. Two
 * pointers over one thing is not two gestures.
 */
export interface Drags {
  readonly start: (from: PointerEvent, gesture: Gesture) => void
}

export const createDrags = (): Drags => {
  let inFlight: (() => void) | undefined
  onCleanup(() => inFlight?.())
  return {
    start: (from, gesture) => {
      inFlight?.()
      inFlight = drag(from, {
        ...gesture,
        onEnd: (event) => {
          inFlight = undefined
          gesture.onEnd(event)
        },
      })
    },
  }
}
