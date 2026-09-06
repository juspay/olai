/**
 * WHAT A GESTURE MEASURES OFF THE PAGE: a drawn row's LINE, and the box a PANE
 * occupies.
 *
 * The second half arrived with the second pane, and the two are one subject
 * because they are the two halves of "which page, and where". They are NOT the
 * same scope, and getting that wrong is the bug this module exists to prevent:
 *
 *   - **the lines are a PAGE's.** A `Row.key` is a chain from the roots of its
 *     page, so it is unique inside one and not across two — "where are the
 *     lines" cannot be asked without saying which page, and the page is the box
 *     it draws its rows in ({@link measureLines} takes it). Scoping to the PANE
 *     instead would be a tighter question answered with a wider one, correct
 *     only while a pane draws exactly one page.
 *   - **the box is a PANE's.** Which COLUMN a pointer is over is a question
 *     about the column, and the answer has to cover the whole of it — the
 *     chrome above the rows included, since a pointer over a pane's filter bar
 *     is over that pane ({@link paneOf} plus {@link measureBox}, read by
 *     `./aim.ts` and by nothing else).
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

/**
 * The attribute one PANE wears — its index in the workspace
 * (`../pane/PageView.tsx`).
 *
 * Read here rather than drawn here, and read as a BOUNDARY rather than as a
 * number: what the aim wants is the COLUMN a pointer is in, and the pane's own
 * element is the one box in the tree that means exactly that.
 * `../claims.test.ts` holds the files entitled to spell it.
 */
const PANE = "data-pane"

/**
 * The PANE something is drawn in, as the element to measure a column by.
 *
 * NOT what {@link measureLines} is scoped to — that is the page's own box, and
 * the difference is the header of this file. The document body when there is no
 * pane above it, which is not a fallback anybody relies on (every editable page
 * in this app is drawn inside one) but an answer rather than a `null` every
 * caller would have to answer for.
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
