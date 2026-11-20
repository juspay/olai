export const ROW_KEY = "data-row-key"

const PANE = "data-pane"

export const paneOf = (within: Element): Element =>
  within.closest(`[${PANE}]`) ?? document.body

export interface Line {
  readonly key: string
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

export const measureLines = (root: ParentNode): ReadonlyArray<Line> => {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  return [...root.querySelectorAll(`[${ROW_KEY}]`)].flatMap((line): ReadonlyArray<Line> => {
    const key = line.getAttribute(ROW_KEY)
    if (key === null) return []
    const box = line.getBoundingClientRect()
    return [{
      key,
      top: box.top + scrollY,
      bottom: box.bottom + scrollY,
      left: box.left + scrollX,
      right: box.right + scrollX,
    }]
  })
}

export interface Box {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export const measureBox = (element: Element): Box | null => {
  const box = element.getBoundingClientRect()
  const top = Math.max(box.top, 0)
  const bottom = Math.min(box.bottom, document.documentElement.clientHeight)
  if (bottom <= top || box.width <= 0) return null
  return {
    top: top + window.scrollY,
    left: box.left + window.scrollX,
    width: box.width,
    height: bottom - top,
  }
}
