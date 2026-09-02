/**
 * Where in a title a click lands.
 *
 * A title is drawn as rendered markdown and edited as its SOURCE, in an
 * `<input>` that is not yet on the page when the click arrives
 * (`./RowEditor.tsx`). The click's X is a fact about the span that is about
 * to go away; the caret is a fact about the string that will replace it.
 * This file is the map between them.
 *
 * **Past the glyphs is the end of the line**, not a position in it. The
 * title's cell stretches to the pane (`../NodeLine.tsx`'s filler), and a
 * press there has always meant "open this row" rather than "put me in a
 * character". Returning `undefined` is that answer, and `takeCaret` already
 * reads absent as the end.
 *
 * **Inside the glyphs, the source is measured as it will be typed.** A
 * hidden canvas, the element's own font, prefix widths. For a plain title
 * that is exact; for `**bold**` it is the honest approximation, because the
 * input will show the asterisks and the mouse will no longer be over the
 * same pixels. Binary search rather than a walk so a long title is still
 * one click.
 *
 * Pure of the DOM beyond the numbers it is handed, so the part anybody
 * would get wrong — past-the-text, before-the-first, the closer of two
 * neighbours — is a unit test.
 */

export interface Box {
  readonly left: number
  readonly width: number
}

/**
 * The caret offset into `source` for a click at `clientX` on `box`, or
 * `undefined` when the click is past the glyphs (the filler, the badges)
 * and the editor should open at the end.
 *
 * `widthOf` is the width of a PREFIX of `source` in the font the title is
 * drawn in. The caller owns the canvas; this file does not touch one.
 */
export const offsetAt = (
  source: string,
  box: Box,
  clientX: number,
  widthOf: (text: string) => number,
): number | undefined => {
  if (source.length === 0) return 0
  const x = clientX - box.left
  if (x <= 0) return 0
  // Past the box is the filler. Equal to the box's right edge is the last
  // pixel of the last glyph; that one is still a character, so the bound
  // is strict.
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

/**
 * The title's own box inside a click that opened it, and a measurer in
 * that box's font.
 *
 * The click is on the LINE (`../NodeLine.tsx`), which also holds the
 * filler, the date, the ⇢ of a mirror. The glyphs are `[data-testid=
 * node-title]`; measuring from there rather than from the line is what
 * keeps a press on the filler from being read as a character.
 *
 * `null` is "there is no title box", which the caller treats as the end
 * — the same answer as a click past the glyphs.
 */
export const titleBox = (
  event: MouseEvent,
): { readonly box: Box; readonly widthOf: (text: string) => number } | null => {
  if (!(event.currentTarget instanceof Element)) return null
  const host = event.currentTarget.querySelector("[data-testid=\"node-title\"]")
  if (!(host instanceof HTMLElement)) return null
  // The ⇢ of a mirror is a sibling in front of the words. Measuring the
  // markdown span (when it is there) rather than the host keeps that mark
  // from shifting every offset by a character of padding.
  const glyphs = host.querySelector(".olai-md")
  const el = glyphs instanceof HTMLElement ? glyphs : host
  const rect = el.getBoundingClientRect()
  return { box: { left: rect.left, width: rect.width }, widthOf: widthIn(el) }
}

/** Prefix widths of `source`, in `el`'s computed font. */
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
