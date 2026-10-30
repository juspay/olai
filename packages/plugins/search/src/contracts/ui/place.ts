/** A result's file, then ancestors from the file down. Separate parts let
 * every search door keep the file and nearest ancestor while the middle shrinks.
 * These are existing hit fields; no new reading or ownership boundary.
 *
 * THE IDS ride beside the titles where the answer carried them
 * (`@olai/format`'s `NodeHit.pathIds`), because a title says where a hit sits
 * and an id is what a browser needs to act on it — the crumb of an ancestor
 * holding a conversation wears that conversation's mark, and a mark is a door.
 * A caller that has only titles still gets a place: it then simply has no ids
 * to hang anything on. */
import type { NodeHit } from "@olai/format"

/** One ancestor, as a crumb can use it. */
export interface PlaceCrumb {
  readonly id: string
  readonly title: string
}

export interface Place {
  readonly file: string
  readonly middle?: string
  readonly nearest?: string
  /** The middle ancestors as ids and titles, in `middle`'s order, where the
   *  answer carried ids. */
  readonly middleCrumbs?: ReadonlyArray<PlaceCrumb>
  /** ...and the nearest ancestor as a crumb, where the answer carried its id. */
  readonly nearestCrumb?: PlaceCrumb
}

export const nodePlace = (
  hit: Pick<NodeHit, "file" | "path"> & { readonly pathIds?: ReadonlyArray<string> },
): Place => {
  const ids = hit.pathIds?.length === hit.path.length ? hit.pathIds : undefined
  const crumbs = ids?.map((id, at) => ({ id, title: hit.path[at]! }))
  return {
    file: hit.file,
    ...(hit.path.length > 1
      ? { middle: hit.path.slice(0, -1).join(" · "), ...(crumbs === undefined ? {} : { middleCrumbs: crumbs.slice(0, -1) }) }
      : {}),
    ...(hit.path.length > 0
      ? { nearest: hit.path[hit.path.length - 1]!, ...(crumbs === undefined ? {} : { nearestCrumb: crumbs[crumbs.length - 1]! }) }
      : {}),
  }
}
