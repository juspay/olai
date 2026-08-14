/**
 * Where a dragged row would LAND — the whole of drag-drop that is arithmetic.
 *
 * Workflowy's gesture is not "drop onto a row"; it is a caret for the tree. The
 * pointer picks a GAP between two drawn lines (which run of siblings the row
 * joins, and after which of them), and the pointer's X picks a DEPTH within
 * that gap (how far in). Both halves are needed — a gap alone cannot tell "last
 * child of the branch above" from "next sibling of that branch's parent",
 * because on screen those are the same line — and it is why the indicator moves
 * sideways as well as up and down.
 *
 * Pure over MEASURED rows: rects in, a placement out. The measuring is the
 * component's (`./dragging.ts`), so the only part anybody can get wrong — which
 * parent a depth resolves to, what the ends of the list mean — is a unit test
 * rather than a thing to try with a mouse.
 *
 * WHAT COMES OUT is a parent and the sibling to sit after, which is exactly the
 * surface's existing `place` verb: no new wire verb, no new op, and the same
 * request an agent's `move_node` sends. `after: null` means FIRST among that
 * parent's children — the one placement `Anchor` cannot spell, which is why
 * `place` exists at all (`../../../surface/src/edit.ts`).
 *
 * THE ROWS BEING DRAGGED ARE NOT IN THE LIST. A subtree moves whole, so every
 * row inside it is a place the drop cannot go, and leaving them out is what
 * makes that true by construction rather than by a guard: what is left is still
 * a tree (removing whole subtrees from a drawn tree leaves one), so the walk
 * back for an ancestor below always finds one.
 */

/** One row the drop can land beside, as measured on screen. */
export interface Placed {
  /** `Row.key` — the place, which is what a selection and the caret name. */
  readonly key: string
  /** The RECORD's id: what a `place` names, so a placement moves as itself. */
  readonly id: string
  /** The record it sits under, `null` at the top level of the page. */
  readonly parent: string | null
  /** How far in it is drawn, counted from the roots of this page. */
  readonly depth: number
  readonly top: number
  readonly bottom: number
  /** The left edge of its line, which is what the depth of a gap is read
   *  against. */
  readonly left: number
  /** The right edge of it. Nothing here reads it — a placement is decided by
   *  the gap and the depth — but the indicator drawn to promise the answer has
   *  to end somewhere, and this is the measurement it ends at. Carried on the
   *  measured row rather than taken a second time, so the line and the answer
   *  are read off one look at the page. */
  readonly right: number
}

/**
 * A landing place: what the drop WOULD DO, and where to draw the line that
 * promises it.
 *
 * ONE value, because a caller that got the placement and then measured the line
 * for itself would be reading the same rows twice and could disagree with this
 * module about which gap it meant. It is also the shape that keeps the steps
 * below private: the arithmetic is not a toolkit, it is one answer.
 */
export interface Landing {
  readonly parent: string | null
  /** The sibling it lands after, or `null` for first among them. */
  readonly after: string | null
  /** Where the indicator goes, in the coordinates the rows were measured in. */
  readonly top: number
  readonly left: number
  readonly width: number
  /** How far in the line is drawn — the answer, as a fact rather than as a
   *  position, which is what a scenario holds this to. */
  readonly depth: number
}

/** The placement half, before the line is measured for it. */
interface Drop {
  readonly parent: string | null
  readonly after: string | null
  readonly gap: number
  readonly depth: number
}

/**
 * How far one level indents, in pixels, read off the rows themselves.
 *
 * Measured rather than imported because the number is a media query away
 * (`../touch.ts`'s `CHILD_INDENT` is `ml-3 pl-3` on a phone and `ml-4 pl-4`
 * above it), and a constant here would be right on one of them.
 */
const indentOf = (rows: ReadonlyArray<Placed>): number | null => {
  const first = rows[0]
  if (first === undefined) return null
  for (const row of rows) {
    if (row.depth === first.depth) continue
    return Math.abs(row.left - first.left) / Math.abs(row.depth - first.depth)
  }
  return null
}

/** What to indent by when the page cannot say — every row on screen at one
 *  depth, which is a whole outline of roots or a zoomed leaf's children. The
 *  desktop step, because that is the one a pointer is nearly always on; being
 *  a few pixels out only changes how far the pointer has to travel to ask for
 *  the one extra depth such a page offers. */
const FALLBACK_INDENT = 32

/**
 * Which gap the pointer is in: the number of rows whose middle is above it.
 *
 * The MIDDLE rather than an edge, so the indicator flips to the other side of a
 * line exactly when the pointer crosses its centre — which is what makes a
 * short drag between two adjacent rows feel like it snaps rather than sticks.
 */
const gapAt = (rows: ReadonlyArray<Placed>, y: number): number =>
  rows.filter((row) => y > (row.top + row.bottom) / 2).length

/**
 * The depths a gap can hold.
 *
 * The deepest is one INSIDE the row above — a drop there is "become its first
 * child", which is the only way a pointer can reach a branch that is empty or
 * collapsed. The shallowest is the depth of the row BELOW, because anything
 * shallower would draw a line above rows that are already deeper than it and
 * promise a shape the tree cannot hold. At the end of the list there is no row
 * below, so the top level is reachable.
 */
const depthsAt = (
  rows: ReadonlyArray<Placed>,
  gap: number,
): { readonly min: number; readonly max: number } => {
  const above = rows[gap - 1]
  const below = rows[gap]
  const max = above === undefined ? below?.depth ?? 0 : above.depth + 1
  const min = below?.depth ?? 0
  return { min: Math.min(min, max), max }
}

/** The depth the pointer is asking for, clamped to what the gap can hold. The
 *  origin is read off a row rather than off the page: `left - depth × indent`
 *  is where depth 0 starts, and every row agrees about it. */
const depthAt = (
  rows: ReadonlyArray<Placed>,
  gap: number,
  x: number,
  indent: number,
): number => {
  const { min, max } = depthsAt(rows, gap)
  const first = rows[0]
  if (first === undefined) return min
  const origin = first.left - first.depth * indent
  const asked = Math.round((x - origin) / indent)
  return Math.min(max, Math.max(min, asked))
}

/**
 * The placement a gap and a depth add up to.
 *
 * Three cases, and the middle one is the whole reason a depth is read at all:
 *
 *   - nothing above — the drop is before the first row drawn, so it joins that
 *     row's siblings at the front. `null` when the page draws nothing at all.
 *   - deeper than the row above — it becomes that row's FIRST child.
 *   - anything else — walk back for the last row at that depth, which is the
 *     sibling this one lands after. It is always found: the rows before a gap
 *     contain an ancestor of the row above at every depth down to the page's
 *     roots, which is what a tree is.
 */
const dropAt = (
  rows: ReadonlyArray<Placed>,
  gap: number,
  depth: number,
): Drop | null => {
  const above = rows[gap - 1]
  if (above === undefined) {
    const below = rows[gap]
    return below === undefined
      ? null
      : { parent: below.parent, after: null, gap, depth: below.depth }
  }
  if (depth > above.depth) {
    return { parent: above.id, after: null, gap, depth: above.depth + 1 }
  }
  for (let at = gap - 1; at >= 0; at--) {
    const row = rows[at]
    if (row !== undefined && row.depth === depth) {
      return { parent: row.parent, after: row.id, gap, depth }
    }
  }
  return null
}

/**
 * What a pointer at `(x, y)` over these rows is asking for — the ONE thing this
 * module answers.
 *
 * The steps above are private on purpose: a consumer that composed them would
 * be the missing-primitive smell, and the missing primitive is exactly this
 * composition. The indent is read once here and both halves use it — the depth
 * the pointer is asking for, and where to draw the line that promises it — so
 * the answer and the affordance cannot come from two readings of the page.
 */
export const planDrop = (
  rows: ReadonlyArray<Placed>,
  x: number,
  y: number,
): Landing | null => {
  const gap = gapAt(rows, y)
  const indent = indentOf(rows) ?? FALLBACK_INDENT
  const drop = dropAt(rows, gap, depthAt(rows, gap, x, indent))
  if (drop === null) return null
  // Along the gap it names, offset to the depth it promises. The rows either
  // side of that gap are what say where it is on screen: a drop at the end of
  // the list sits under the last row, one at the top sits above the first.
  const above = rows[drop.gap - 1]
  const beside = above ?? rows[drop.gap]
  const edge = above?.bottom ?? rows[drop.gap]?.top
  if (beside === undefined || edge === undefined) return null
  const left = beside.left - beside.depth * indent + drop.depth * indent
  return {
    parent: drop.parent,
    after: drop.after,
    depth: drop.depth,
    top: edge,
    left,
    width: Math.max(0, beside.right - left),
  }
}
