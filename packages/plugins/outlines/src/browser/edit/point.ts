export interface Box {
  readonly left: number
  readonly width: number
}

export const offsetAt = (
  source: string,
  box: Box,
  clientX: number,
  widthOf: (text: string) => number,
): number | undefined => {
  if (source.length === 0) return 0
  const x = clientX - box.left
  if (x <= 0) return 0
  if (x > box.width) return undefined
  let lo = 0
  let hi = source.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (widthOf(source.slice(0, mid)) < x) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return 0
  const left = widthOf(source.slice(0, lo - 1))
  const right = widthOf(source.slice(0, lo))
  return x - left <= right - x ? lo - 1 : lo
}

export const titleBox = (
  event: MouseEvent,
): { readonly box: Box; readonly widthOf: (text: string) => number } | null => {
  if (!(event.currentTarget instanceof Element)) return null
  const host = event.currentTarget.querySelector("[data-testid=\"node-title\"]")
  if (!(host instanceof HTMLElement)) return null
  const glyphs = host.querySelector(".olai-md")
  const el = glyphs instanceof HTMLElement ? glyphs : host
  const rect = el.getBoundingClientRect()
  return { box: { left: rect.left, width: rect.width }, widthOf: widthIn(el) }
}

export const widthIn = (el: Element): ((text: string) => number) => {
  const font = getComputedStyle(el).font
  return (text: string): number => {
    const ctx = context()
    ctx.font = font
    return ctx.measureText(text).width
  }
}

let canvas: CanvasRenderingContext2D | undefined

const context = (): CanvasRenderingContext2D => {
  if (canvas !== undefined) return canvas
  const node = document.createElement("canvas")
  const ctx = node.getContext("2d")
  if (ctx === null) {
    throw new Error("olai: no 2d canvas — cannot measure a title click")
  }
  canvas = ctx
  return ctx
}
