/**
 * One node, as a page.
 *
 * An id is the whole address (`/n/<id>` in the browser): ids are unique across
 * the loaded set and survive renames and moves, so a link to a node outlives
 * every edit short of deleting it. Which file the node lives in and where it
 * sits in the tree are DERIVED here, not carried in the address — the outline
 * is a fact about the node, and a URL that repeated it would be a URL that
 * could disagree with the file.
 *
 * There is exactly one page per node, and a mirror does not get one of its own.
 * A mirror is a second placement of a node that already exists, so zooming one
 * follows its chain and lands on the regular node at the end — with THAT node's
 * ancestry above it. Anything else would give the same node two pages whose
 * crumbs disagreed, and a reader no way to tell which was the real one.
 *
 * The three ways an id fails to name a page are told apart, because they are
 * three different things to fix: nothing declares it, a mirror chain from it
 * dies on a missing target, or the chain closes on itself.
 */

import {
  ancestorsOf,
  type Derived,
  follow,
  type Row,
  rowsUnder,
  type Status,
} from "./derive.ts"
import type { LocatedRegular } from "./node.ts"

/** What `/n/<id>` shows: a node, or the reason it cannot. */
export type Zoomed =
  | {
    readonly kind: "node"
    /** The regular node at the end of the chain — the page is always this
     *  node's, whichever record was addressed to reach it. */
    readonly shows: LocatedRegular
    readonly status: Status
    /** The canonical parent chain, root first, `shows` excluded. */
    readonly trail: ReadonlyArray<LocatedRegular>
    readonly children: ReadonlyArray<Row>
  }
  | { readonly kind: "unknown"; readonly id: string }
  | { readonly kind: "dangling"; readonly id: string; readonly missing: string }
  | { readonly kind: "cycle"; readonly id: string; readonly through: string }

export const zoom = (derived: Derived, id: string): Zoomed => {
  const at = derived.byId.get(id)
  if (at === undefined) return { kind: "unknown", id }

  const found = follow(derived, at)
  if (found.kind === "dangling") return { kind: "dangling", id, missing: found.missing }
  if (found.kind === "cycle") return { kind: "cycle", id, through: found.through }

  // One walk up, used twice: the crumbs above the heading and the guard that
  // stops a mirror of an ancestor expanding forever below it are the same
  // chain, and asking for it twice is two answers that could differ.
  const trail = ancestorsOf(derived, found.shows.node.id)
  return {
    kind: "node",
    shows: found.shows,
    status: derived.status.get(found.shows.node.id) ?? "open",
    trail,
    children: rowsUnder(derived, found.shows, trail),
  }
}
