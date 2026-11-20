export interface Box {
  readonly left: number
  readonly top: number
  readonly bottom: number
}

export interface Viewport {
  readonly width: number
  readonly height: number
}

export interface Anchor {
  readonly left: number
  readonly width: number
  readonly maxHeight: number
  readonly side: "bottom" | "top"
  readonly offset: number
}

const GAP = 8
const MARGIN = 12

const WANTED = 384

export type AnchorStyle = {
  readonly left: string
  readonly width: string
  readonly "max-height": string
  readonly top: string | undefined
  readonly bottom: string | undefined
}

export const styleOf = (at: Anchor): AnchorStyle =>
  at.side === "bottom"
    ? {
      left: `${at.left}px`,
      width: `${at.width}px`,
      "max-height": `${at.maxHeight}px`,
      bottom: `${at.offset}px`,
      top: undefined,
    }
    : {
      left: `${at.left}px`,
      width: `${at.width}px`,
      "max-height": `${at.maxHeight}px`,
      bottom: undefined,
      top: `${at.offset}px`,
    }

export const anchoredTo = (pill: Box, view: Viewport): Anchor => {
  const width = Math.max(0, Math.min(WANTED, view.width - MARGIN * 2))
  const left = Math.max(MARGIN, Math.min(pill.left, view.width - width - MARGIN))

  const above = Math.max(0, pill.top - GAP - MARGIN)
  const below = Math.max(0, view.height - pill.bottom - GAP - MARGIN)
  return above >= below
    ? { left, width, side: "bottom", offset: view.height - pill.top + GAP, maxHeight: above }
    : { left, width, side: "top", offset: pill.bottom + GAP, maxHeight: below }
}
