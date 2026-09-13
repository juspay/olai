import { createDrags, TRAVEL_PX, type Gesture } from "./pointer.ts"
import { longPressOn } from "./longPress.ts"

/** A carrier decides what a lift means. This owner decides when a press becomes
 * a lift, owns its listeners and scroll claim, and suppresses its trailing click.
 * Nothing is claimed before pointer travel or the touch hold deadline. */
export const createLifting = <S>(lift: (source: S) => Pick<Gesture, "onPage" | "onEnd"> | null) => {
  const drags = createDrags()
  let travelled = false
  const start = (from: PointerEvent, source: S, held: boolean) => {
    let flight: ReturnType<typeof lift> = null
    const stopScroll = (event: TouchEvent) => event.preventDefault()
    const begin = () => {
      flight = lift(source)
      if (flight === null) return
      travelled = true
      if (held) window.addEventListener("touchmove", stopScroll, { passive: false })
    }
    drags.start(from, {
      threshold: held ? 0 : TRAVEL_PX,
      onStart: held ? undefined : begin,
      onPage: (x, y) => flight?.onPage?.(x, y),
      onEnd: up => {
        window.removeEventListener("touchmove", stopScroll)
        flight?.onEnd(up)
      },
    })
    // Starting first cancels the previous flight before acquiring the new one.
    if (held) begin()
  }
  let pressed: { source: S } | undefined
  const watcher = longPressOn(from => { if (pressed) start(from, pressed.source, true) })
  return {
    grab: (event: PointerEvent, source: S) => {
      if (event.button !== 0) return
      // A release elsewhere may never click the handle. Reset on the next press.
      travelled = false
      if (event.pointerType === "touch") {
        pressed = { source }
        watcher.onPointerDown(event)
      } else start(event, source, false)
    },
    heldMenu: watcher.onContextMenu,
    dragged: () => travelled,
    click: (event: MouseEvent) => { if (travelled) { event.preventDefault(); event.stopPropagation() } },
  }
}
