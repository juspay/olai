/**
 * The order a directory's files are drawn in.
 *
 * One rule, and it exists because the app now assembles the file list itself:
 * the outlines arrive as a keyed COLLECTION, whose key order is ARRIVAL order —
 * the snapshot's order on a fresh subscription, and appended after that — so an
 * outline created while the tab was open would sit at the bottom of the sidebar
 * until a reload. Order is a property of the paths, so it is decided here
 * rather than promised by the wire.
 *
 * This is the CLIENT's own order for a set of paths, not a contract with
 * anything. It is spelled to match what a directory walk produces (`@olai/store`
 * descends into each directory in sorted order) because that is the order a
 * reader of the same directory sees everywhere else — but nothing reads both
 * and compares them, and if the two ever diverged the sidebar would simply sort
 * its own way.
 */

/** Path order, segment by segment: `a/b.olai` sorts before `a.olai` exactly
 *  as descending into `a` before reading `a.olai` does. A plain string compare
 *  disagrees, because `.` sorts before `/`. */
const compare = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): number => {
  for (let at = 0; at < Math.min(left.length, right.length); at++) {
    const one = left[at] as string
    const other = right[at] as string
    if (one !== other) return one < other ? -1 : 1
  }
  return left.length - right.length
}

/** Paths in that order. Each path is split ONCE rather than once per
 *  comparison, which is the difference between n and n log n allocations for a
 *  list that is re-sorted whenever the directory gains or loses a file. */
export const sortByPath = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths]
    .map((path) => ({ path, segments: path.split("/") }))
    .sort((one, other) => compare(one.segments, other.segments))
    .map(({ path }) => path)
