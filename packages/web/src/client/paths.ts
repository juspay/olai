/**
 * The order a directory's files are drawn in.
 *
 * One rule, and it exists because the app now assembles the file list itself:
 * the outlines arrive as a keyed COLLECTION, whose key order is arrival order —
 * the snapshot's order on a fresh subscription, and appended after that — so an
 * outline created while the tab was open would sit at the bottom of the sidebar
 * until a reload. Order is a property of the paths, so it is decided here
 * rather than promised by the wire.
 */

/**
 * Path order, the way a directory walk produces it: segment by segment, so
 * `a/b.jsonl` sorts before `a.jsonl` exactly as descending into `a` before
 * reading `a.jsonl` does. A plain string compare disagrees — `.` sorts before
 * `/` — and would put a nested outline somewhere the server's own listing never
 * would (`@olai/store`'s disk walk is depth-first through sorted entries).
 */
export const byPath = (a: string, b: string): number => {
  const left = a.split("/")
  const right = b.split("/")
  for (let at = 0; at < Math.min(left.length, right.length); at++) {
    const one = left[at] as string
    const other = right[at] as string
    if (one !== other) return one < other ? -1 : 1
  }
  return left.length - right.length
}
