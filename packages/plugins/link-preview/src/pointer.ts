/** Boundary events classify once. Layout-only arrivals wait for real movement;
 * ordinary movement within an already entered element never reclassifies it. */
export function pointerEdges<E extends { readonly clientX: number; readonly clientY: number; readonly target: EventTarget | null }>(enter: (event: E) => void) {
  let point: { x: number; y: number } | undefined
  let skipped: EventTarget | null = null
  return {
    over(event: E) {
      skipped = null
      if (point?.x === event.clientX && point.y === event.clientY) { skipped = event.target; return }
      enter(event)
    },
    move(event: E) {
      if (point?.x === event.clientX && point.y === event.clientY) return
      point = { x: event.clientX, y: event.clientY }
      if (skipped !== null && skipped === event.target) { skipped = null; enter(event) }
    },
  }
}
