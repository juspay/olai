import { innermost, type Carried, type Landings, type Lifted } from "@olai/plugin-api/carry"
import { createDrags, TRAVEL_PX } from "./pointer.ts"
import { longPressOn } from "./longPress.ts"

export const documentBox = (element: Element | undefined) => {
  if (!element?.isConnected) return null
  const b = element.getBoundingClientRect()
  if (b.width === 0 || b.height === 0) return null
  return { left: b.left + window.scrollX, right: b.right + window.scrollX, top: b.top + window.scrollY, bottom: b.bottom + window.scrollY }
}
/** A snapshot chooses eligible receivers; live membership and geometry govern aiming. */
export const carrySession = <C extends Carried>(carried: C, table: Landings) => {
  const snapshot = table.lift(carried)
  let aimed: Lifted | null = null
  let point = { x: 0, y: 0 }
  const leave = () => { aimed?.receiver.leave(); aimed = null }
  return {
    aim: (x: number, y: number) => {
      point = { x, y }
      const next = innermost(snapshot.flatMap(entry => {
        if (!table.standing(entry.receiver)) return []
        const box = entry.receiver.lift(carried)
        return box === null ? [] : [{ receiver: entry.receiver, box }]
      }), x, y)
      if (next?.receiver !== aimed?.receiver) leave()
      aimed = next
      aimed?.receiver.aim(carried, x, y)
      return aimed !== null
    },
    end: async (drop: boolean) => {
      const target = aimed
      leave()
      return drop && target !== null && table.standing(target.receiver)
        ? target.receiver.drop(carried, point.x, point.y) : null
    },
  }
}
/** Component-owned pointer and long-press carries; click suppression is read by the carrier. */
export const createCarry = (payload: () => Carried | null, table: () => Landings | undefined, options: { readonly onLift?: () => void; readonly refused?: (why: string) => void } = {}) => {
  const drags = createDrags()
  let travelled = false
  const start = (from: PointerEvent, held: boolean) => {
    let session: ReturnType<typeof carrySession> | undefined
    const stopScroll = (event: TouchEvent) => event.preventDefault()
    const lift = () => {
      const value = payload(), landings = table()
      if (value === null || landings === undefined) return
      travelled = true
      session = carrySession(value, landings)
      if (held) window.addEventListener("touchmove", stopScroll, { passive: false })
      options.onLift?.()
    }
    if (held) lift()
    drags.start(from, {
      threshold: held ? 0 : TRAVEL_PX,
      onStart: held ? undefined : lift,
      onPage: (x, y) => { session?.aim(x, y) },
      onEnd: up => {
        window.removeEventListener("touchmove", stopScroll)
        void session?.end(up !== null).then(why => { if (why) options.refused?.(why) })
      },
    })
  }
  const watcher = longPressOn(from => start(from, true))
  return {
    grab: (event: PointerEvent) => {
      if (event.button !== 0) return
      travelled = false
      if (event.pointerType === "touch") watcher.onPointerDown(event)
      else start(event, false)
    },
    heldMenu: watcher.onContextMenu,
    click: (event: MouseEvent) => { if (travelled) { event.preventDefault(); event.stopPropagation() } },
  }
}
