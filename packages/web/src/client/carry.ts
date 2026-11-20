import { innermost, type Carried, type Landings, type Lifted } from "@olai/plugin-api/carry"
import { createLifting } from "./lifting.ts"

export const documentBox = (element: Element | undefined) => {
  if (!element?.isConnected) return null
  const b = element.getBoundingClientRect()
  if (b.width === 0 || b.height === 0) return null
  return { left: b.left + window.scrollX, right: b.right + window.scrollX, top: b.top + window.scrollY, bottom: b.bottom + window.scrollY }
}
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
        return drop && aimed !== null && table.standing(aimed.receiver)
          ? aimed.receiver.drop(carried, point.x, point.y) : null
      } finally { leave() }
    },
  }
}
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
