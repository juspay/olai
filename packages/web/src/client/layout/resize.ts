/**
 * Drag-resize for a single panel edge.
 *
 * Deliberately hand-rolled rather than a resizable-panels library. The two
 * panels here are independent docks with absolute pixel widths persisted in
 * localStorage, not a flex group that redistributes fractions between
 * siblings. A library that owns a group would fight that model; a few lines of
 * pointer capture own it cleanly and stay inside the house preference pattern.
 *
 * Axis is horizontal only. `edge: "right"` means the handle sits on the
 * right of its panel (sidebar): dragging right grows it. `edge: "left"` is the
 * chat dock: dragging left grows it (delta inverted).
 */

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
 * Begin a drag. Attaches window listeners until pointerup/cancel; returns a
 * teardown if the caller needs to cancel early (unmount mid-drag).
 */
export const startResize = (opts: ResizeStart): (() => void) => {
  const originX = opts.event.clientX
  const originW = opts.startWidth
  let last = originW

  // Prevent text selection while dragging.
  const previousUserSelect = document.body.style.userSelect
  document.body.style.userSelect = "none"

  const onMove = (event: PointerEvent) => {
    const dx = event.clientX - originX
    const raw = opts.edge === "right" ? originW + dx : originW - dx
    last = clamp(Math.round(raw), opts.min, opts.max)
    opts.onMove(last)
  }

  const end = () => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", end)
    window.removeEventListener("pointercancel", end)
    document.body.style.userSelect = previousUserSelect
    opts.onEnd?.(last)
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", end)
  window.addEventListener("pointercancel", end)

  // Consume the starting event so a click handler on the same node does not
  // also fire a toggle when the drag was tiny.
  opts.event.preventDefault()

  return end
}
