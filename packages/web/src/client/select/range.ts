/**
 * Which rows a multi-select covers — the arithmetic, over places.
 *
 * A selection is a set of `Row.key`s, and a key is the chain of ids from the
 * root of the page (`@olai/format`'s `expand`). That one fact is what makes
 * every question here a string question rather than a walk: the row drawn under
 * `/kitchen/install` is exactly the row whose key starts `/kitchen/install/`,
 * so containment, siblinghood and "the ancestor at this depth" are all answered
 * without the tree.
 *
 * PLACES, not nodes, and it is the same split the caret already makes
 * (`../edit/order.ts`): the same node reached through two mirrors is two rows
 * on screen, and selecting one must not select the other.
 *
 * The one rule with teeth is {@link topmost}. A person dragging across an
 * outline selects a parent and the children under it, because that is what
 * dragging across them looks like — and every bulk verb takes a SUBTREE, so
 * sending an op for the child as well would be an op about a row that has
 * already moved with its parent, judged against a set where it is no longer
 * where the selection said it was. So what a verb is asked of is the rows
 * nothing else in the selection contains.
 */

import type { Row } from "@olai/format"

/** The key of the place a row is drawn under — `""` for a root of the page,
 *  which is a real answer rather than an absence: two roots share it, and that
 *  is what makes them siblings. */
export const parentKeyOf = (key: string): string => key.slice(0, key.lastIndexOf("/"))

/** The RECORD standing at a place: the last id of the chain. The other half of
 *  the same split, and it is what lets a selection be looked up again after the
 *  rows it named were redrawn somewhere else. */
export const recordOf = (key: string): string => key.slice(key.lastIndexOf("/") + 1)

/** How far in a place is drawn: the number of ancestors above it on this page.
 *  A chain of ids is a chain of separators, and an id is a slug — letters,
 *  digits, `_` and `-` (`@olai/format`'s parse rules) — so nothing in one can
 *  be mistaken for the separator. Read by the drop planner, which needs a depth
 *  per drawn row and would otherwise walk the tree a second time. */
export const depthOf = (key: string): number => key.split("/").length - 2

/** Is the row at `key` drawn somewhere under the row at `ancestor`? A row is
 *  not under itself — the boundary that makes {@link topmost} keep exactly one
 *  of a chain rather than none of it. */
export const inside = (ancestor: string, key: string): boolean =>
  key.startsWith(`${ancestor}/`)

/** Is this place one of `these`, or drawn under one of them? The other reading
 *  of {@link inside} — the one a SUBTREE gesture wants, where a branch and
 *  everything filed beneath it are the same answer. A drag asks it twice, of
 *  the rows it fades and of the rows it may not land beside, and those two must
 *  agree or the affordance would offer a place it then moved away from. */
export const beneath = (these: ReadonlySet<string>, key: string): boolean =>
  these.has(key) || [...these].some((one) => inside(one, key))

/**
 * Every place between two, inclusive, in the order they are drawn.
 *
 * The two ends arrive in whichever order they were pressed — an anchor above
 * the row shift-clicked, or below it — so the span is taken over INDEXES rather
 * than over the keys, and a range whose ends are the same row is that one row.
 * An end that is not drawn (the anchor's row went away under a live frame)
 * answers with nothing, which is the honest reading: there is no span between a
 * row and one that is not on screen.
 */
export const spanning = (
  drawn: ReadonlyArray<Row>,
  from: string,
  to: string,
): ReadonlyArray<string> => {
  const at = drawn.findIndex((row) => row.key === from)
  const until = drawn.findIndex((row) => row.key === to)
  if (at === -1 || until === -1) return []
  const [first, last] = at <= until ? [at, until] : [until, at]
  return drawn.slice(first, last + 1).map((row) => row.key)
}

/**
 * The selected rows nothing else selected contains, in the order they are
 * drawn.
 *
 * This is what every bulk verb is asked of, and the header says why. Drawn
 * order is not incidental either: indenting a run of siblings is one `move` per
 * row judged against what the one before it did, so the order the ops go out in
 * IS the shape they produce (`./bulk.ts`).
 */
export const topmost = (
  drawn: ReadonlyArray<Row>,
  keys: ReadonlySet<string>,
): ReadonlyArray<Row> => {
  const chosen = drawn.filter((row) => keys.has(row.key))
  return chosen.filter((row) =>
    !chosen.some((other) => other.key !== row.key && inside(other.key, row.key))
  )
}

/** The places drawn beside this one — the first widening ⌘A offers, and the
 *  reason `parentKeyOf` answers `""` rather than nothing for a root. A key that
 *  is not drawn has no siblings, which is the same answer as "it is alone". */
export const alongside = (
  drawn: ReadonlyArray<Row>,
  key: string,
): ReadonlyArray<string> => {
  if (!drawn.some((row) => row.key === key)) return []
  const parent = parentKeyOf(key)
  return drawn.filter((row) => parentKeyOf(row.key) === parent).map((row) => row.key)
}
