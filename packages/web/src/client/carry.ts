import { innermost, type Carried, type Landings, type Lifted } from "@olai/plugin-api/carry"
import { createLifting } from "./lifting.ts"

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
      try {
        // Capture the destination's indicated work before clearing its visit.
        // Do not await here: indicators and pointer resources leave immediately.
        return drop && aimed !== null && table.standing(aimed.receiver)
          ? aimed.receiver.drop(carried, point.x, point.y) : null
      } finally { leave() }
    },
  }
}
/** Component-owned pointer and long-press carries; click suppression is read by the carrier. */
export const createCarry = (payload: () => Carried | null, table: () => Landings | undefined, options: { readonly onLift?: () => void; readonly refused?: (why: string) => void } = {}) => {
  const gesture = createLifting(() => {
    const value = payload(), landings = table()
    if (value === null || landings === undefined) return null
    const session = carrySession(value, landings)
    options.onLift?.()
    return {
      onPage: session.aim,
      onEnd: (up: PointerEvent | null) => {
        void session.end(up !== null).then(why => { if (why) options.refused?.(why) })
      },
    }
  })
  return { ...gesture, grab: (event: PointerEvent) => gesture.grab(event, undefined) }
}
