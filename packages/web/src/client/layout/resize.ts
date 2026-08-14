/**
 * Drag-resize for a single panel edge.
 *
 * Deliberately not a resizable-panels library. The two panels here are
 * independent docks with absolute pixel widths persisted in localStorage, not a
 * flex group that redistributes fractions between siblings. A library that owns
 * a group would fight that model.
 *
 * What is left once that is said is one line of arithmetic ({@link widthAfter})
 * and the pointer plumbing every drag in this client shares — window listeners,
 * a teardown on every way a gesture can end, the text-selection guard — which
 * lives in `../pointer.ts` and is not this module's to spell. It was this
 * module's until an outline row needed the same thing (`../drag/dragging.ts`);
 * what stayed here is the only part that is about a WIDTH.
 *
 * Axis is horizontal only. `edge: "right"` means the handle sits on the
 * right of its panel (sidebar): dragging right grows it. `edge: "left"` is the
 * chat dock: dragging left grows it (delta inverted).
 */

import { drag as pointerDrag } from "../pointer.ts"
import { clamp } from "./prefs.ts"

export type ResizeEdge = "left" | "right"

export interface ResizeStart {
  readonly event: PointerEvent
  readonly edge: ResizeEdge
  readonly startWidth: number
  readonly min: number
  readonly max: number
  readonly onMove: (width: number) => void
  readonly onEnd?: (width: number) => void
}

/**
 * Pure half of a drag: how an edge maps a pointer delta onto a width.
 * Right-edge (sidebar) grows with +dx; left-edge (chat) grows with −dx.
 */
export const widthAfter = (
  edge: ResizeEdge,
  start: number,
  dx: number,
  min: number,
  max: number,
): number => {
  const raw = edge === "right" ? start + dx : start - dx
  return clamp(Math.round(raw), min, max)
}

/**
 * Begin a drag. Returns a teardown if the caller needs to cancel early
 * (unmount mid-drag) — which still commits the width reached, because a panel
 * left at a width nobody chose is worse than one saved a pixel early.
 *
 * NO THRESHOLD: this handle is only ever a handle, so the first pixel is the
 * gesture. A bullet in the outline is also a link, which is the case the
 * threshold in `../pointer.ts` exists for.
 */
export const startResize = (opts: ResizeStart): (() => void) => {
  const originX = opts.event.clientX
  let last = opts.startWidth

  // Consume the starting event so a click handler on the same node does not
  // also fire a toggle when the drag was tiny.
  opts.event.preventDefault()

  return pointerDrag(opts.event, {
    onMove: (event) => {
      last = widthAfter(
        opts.edge,
        opts.startWidth,
        event.clientX - originX,
        opts.min,
        opts.max,
      )
      opts.onMove(last)
    },
    onEnd: () => opts.onEnd?.(last),
  })
}
