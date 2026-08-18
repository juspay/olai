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
 * **WHICH PAGE'S LINES, and that is not a refinement — it is the fact a split
 * workspace makes load-bearing.** A `Row.key` is the chain of ids from the
 * roots of ITS PAGE (`@olai/format`'s `expand`), so two panes showing one file
 * draw two sets of lines wearing the SAME keys, and a sweep of the whole
 * document would answer a question about pane 1 with the boxes of pane 0. The
 * scope is therefore an argument rather than a default: every caller says which
 * page it means, by handing over anything drawn inside it ({@link paneOf}).
 *
 * MEASURED ONCE, when a gesture begins. Nothing here is optimistic, so nothing
 * on screen moves while a row is in the air — the tree redraws when the file
 * says so. Measuring per `pointermove` would be a forced layout per frame over
 * every row of the tree for an answer that cannot have changed.
 */

/** The attribute a row's LINE carries so a gesture can find it. */
export const ROW_KEY = "data-row-key"

/**
 * The attribute one PANE's page wears — its index in the workspace
 * (`../pane/PageView.tsx`).
 *
 * Read here rather than drawn here, and read as a BOUNDARY rather than as a
 * number: what a gesture wants is "everything drawn in the same page as this",
 * and the pane's own box is the one element in the tree that means exactly
 * that. `../claims.test.ts` holds the three files entitled to spell it.
 */
const PANE = "data-pane"

/**
 * The PAGE something is drawn in, as the element to scope a measurement to.
 *
 * The document body when there is no pane above it, which is not a fallback
 * anybody relies on — every editable page in this app is drawn inside one — but
 * an answer rather than a `null` every caller would have to answer for.
 */
export const paneOf = (within: Element): Element =>
  within.closest(`[${PANE}]`) ?? document.body

/** One drawn row's line, measured. What a gesture needs about a row BEFORE it
 *  needs anything about the node — the drop planner's extra facts ride on top
 *  of this rather than beside it (`./plan.ts`'s `Placed`). */
export interface Line {
  /** `Row.key` — the PLACE, which is what a selection and the caret name.
   *  Unique WITHIN the page it was measured in, and only there. */
  readonly key: string
  readonly top: number
  readonly bottom: number
  /** The left edge of the line, which is what the depth of a gap is read
   *  against and what the width of a sweep's band starts at. */
  readonly left: number
  readonly right: number
}

/**
 * Every drawn line of one page, in the order they are drawn.
 *
 * Document order IS drawn order — that is what `querySelectorAll` answers in —
 * which is what lets the sweep's crossed rows be a contiguous run without a
 * second sort, and what lets the drop planner's walk back for an ancestor
 * always find one.
 */
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

/** A box on the page, in the same coordinates {@link measureLines} answers in.
 *  What the drag needs about a PANE — which one a pointer is over, and where to
 *  draw a refusal that is about the whole of it (`./aim.ts`). */
export interface Box {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

/**
 * Where an element is, clipped to what is ON SCREEN.
 *
 * The clip is the difference between a box and a box worth drawing in. A pane's
 * page is as tall as its outline, which is taller than the window nearly
 * always, so a refusal centred in the raw box would be centred a thousand
 * pixels below the fold — a face nobody sees, which is the failure it exists to
 * prevent. `null` when none of it is on screen at all.
 */
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
