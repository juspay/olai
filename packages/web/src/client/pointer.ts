import { onCleanup } from "solid-js"

import { edgeScrolling } from "./autoscroll.ts"

export interface Gesture {
  readonly onStart?: (event: PointerEvent) => void
  readonly onMove?: (event: PointerEvent) => void
  readonly onPage?: (x: number, y: number) => void
  readonly onEnd: (event: PointerEvent | null) => void
  readonly threshold?: number
}

export const TRAVEL_PX = 4

export const drag = (from: PointerEvent, gesture: Gesture): (() => void) => {
  const originX = from.pageX
  const originY = from.pageY
  const threshold = gesture.threshold ?? 0
  let started = false
  let ended = false
  const selection = document.body.style.userSelect
  document.body.style.userSelect = "none"
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
    if (ended) return
    ended = true
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
    document.removeEventListener("keydown", onKey, true)
    document.body.style.userSelect = selection
    following?.stop()
    gesture.onEnd(event)
  }
  const onUp = (event: PointerEvent) => end(event)
  const onCancel = () => end(null)
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    end(null)
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onCancel)
  // Before app popovers answer Escape, but after the window's IME guard.
  document.addEventListener("keydown", onKey, true)
  return () => end(null)
}

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
