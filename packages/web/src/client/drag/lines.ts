/**
 * A DRAWN ROW'S LINE, as something a gesture can measure — the attribute it
 * carries, the box it occupies, and where every one of them is.
 *
 * Two gestures aim at rows and both begin by asking the page the same question:
 * where are the lines, in coordinates that survive a scroll. Each had its own
 * answer — the same `querySelectorAll`, the same `getBoundingClientRect`, the
 * same `+ scrollX/scrollY` — with the drag owning the attribute name and the
 * sweep importing it from there, which said that measuring a row belongs to
 * dragging one. It does not. It belongs to the ROW, and this is where.
 *
 * **THE LINE AND NOT THE ITEM**, which is the whole reason the attribute is
 * where it is: an `<li>` in this tree contains every row nested under it, so its
 * box is a subtree's box. Both gestures are about the lines a reader SEES — the
 * gaps between them for a drop, the ones a pull passes over for a sweep — so the
 * mark sits on the row's own line (`../Tree.tsx`).
 *
 * **DOCUMENT COORDINATES**, for two reasons that arrive together: the answer
 * survives the page scrolling under a live gesture (which the gestures now do
 * on purpose — `../autoscroll.ts`), and the affordances that promise it are
 * positioned absolutely against the page rather than the window.
 *
 * MEASURED ONCE, when a gesture begins. Nothing here is optimistic, so nothing
 * on screen moves while a row is in the air — the tree redraws when the file
 * says so. Measuring per `pointermove` would be a forced layout per frame over
 * every row of the tree for an answer that cannot have changed.
 */

/** The attribute a row's LINE carries so a gesture can find it. */
export const ROW_KEY = "data-row-key"

/** One drawn row's line, measured. What a gesture needs about a row BEFORE it
 *  needs anything about the node — the drop planner's extra facts ride on top
 *  of this rather than beside it (`./plan.ts`'s `Placed`). */
export interface Line {
  /** `Row.key` — the PLACE, which is what a selection and the caret name. */
  readonly key: string
  readonly top: number
  readonly bottom: number
  /** The left edge of the line, which is what the depth of a gap is read
   *  against and what the width of a sweep's band starts at. */
  readonly left: number
  readonly right: number
}

/**
 * Every drawn line on the page, in the order they are drawn.
 *
 * Document order IS drawn order — that is what `querySelectorAll` answers in —
 * which is what lets the sweep's crossed rows be a contiguous run without a
 * second sort, and what lets the drop planner's walk back for an ancestor
 * always find one.
 */
export const measureLines = (): ReadonlyArray<Line> => {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  return [...document.querySelectorAll(`[${ROW_KEY}]`)].flatMap((line): ReadonlyArray<Line> => {
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
