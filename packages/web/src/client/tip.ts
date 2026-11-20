import { createSignal } from "solid-js"

const MARGIN = 8

const TIP_GAP = 4

export const clampedLeft = (
  anchorLeft: number,
  tipWidth: number,
  viewportWidth: number,
): number => Math.max(MARGIN, Math.min(anchorLeft, viewportWidth - tipWidth - MARGIN))

export const clampedTop = (anchorBottom: number, floor: number): number =>
  Math.max(anchorBottom, floor) + TIP_GAP

export const liftedTop = (
  top: number,
  tipHeight: number,
  viewportHeight: number,
  floor: number,
): number => {
  const pin = Math.max(floor + TIP_GAP, MARGIN)
  return top + tipHeight + MARGIN > viewportHeight
    ? Math.max(pin, viewportHeight - tipHeight - MARGIN)
    : top
}

export type Tipped = { readonly shown: () => boolean }

export const createTips = () => {
  type Token = Tipped & { shown: () => boolean; set: (value: boolean) => void }
  let open: Token | undefined
  return {
    takeTip: (): Token => {
      const [shown, set] = createSignal(false)
      return { shown, set } as Token
    },
    showTip: (tip: Token): void => {
      if (open === tip) return
      open?.set(false)
      open = tip
      tip.set(true)
    },
    hideTip: (tip: Token): void => {
      if (open !== tip) return
      open = undefined
      tip.set(false)
    },
    tipShowing: (tip: Token): boolean => tip.shown(),
  }
}
