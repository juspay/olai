import { drag as pointerDrag } from "@olai/web/client/pointer.ts"
import { clamp } from "./prefs.ts"

export interface ResizeStart {
  readonly event: PointerEvent
  readonly startWidth: number
  readonly min: number
  readonly max: number
  readonly onMove: (width: number) => void
  readonly onEnd?: (width: number) => void
}

export const widthAfter = (
  start: number,
  dx: number,
  min: number,
  max: number,
): number => clamp(Math.round(start + dx), min, max)

export const startResize = (opts: ResizeStart): (() => void) => {
  const originX = opts.event.clientX
  let last = opts.startWidth

  opts.event.preventDefault()

  return pointerDrag(opts.event, {
    onMove: (event) => {
      last = widthAfter(
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
