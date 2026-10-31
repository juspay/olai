/** A result's file, then its ancestors from the file down. ONE encoding: a
 * crumb carries its title, and an id only when the answer carried one. A title
 * says where a hit sits; an id is what a browser needs to act on it — the crumb
 * of an ancestor holding a conversation wears that conversation's mark, and a
 * mark is a door. A caller with only titles still gets a place; its crumbs
 * simply have no ids to hang anything on, and the line draws the words.
 *
 * The line's two PARTS are derived where they are drawn (`./PlaceLine.tsx`):
 * the middle is every crumb but the last, the nearest is the last. Nothing
 * here needs to say that twice as a joined string and again as crumbs. */
import type { NodeHit } from "@olai/format"

/** One ancestor, as a crumb can use it. */
export interface PlaceCrumb {
  /** Absent when the answer carried only the title; a crumb with no id cannot
   *  name a node for a face, so it gets none. */
  readonly id?: string
  readonly title: string
}

export interface Place {
  readonly file: string
  /** Every ancestor from the file down, outermost first; the last is the
   *  nearest, and a top-level node has none. */
  readonly crumbs: ReadonlyArray<PlaceCrumb>
}

export const nodePlace = (
  hit: Pick<NodeHit, "file" | "path"> & { readonly pathIds?: ReadonlyArray<string> },
): Place => {
  // Ids and titles are one walk's answer in `@olai/format`, so they are zipped
  // only when they still describe the same walk; a caller that has titles
  // alone (a folded row, `new-chat-level.ts`) gets crumbs without ids rather
  // than a guessed correspondence.
  const ids = hit.pathIds?.length === hit.path.length ? hit.pathIds : undefined
  return {
    file: hit.file,
    crumbs: hit.path.map((title, at) => ({ title, ...(ids === undefined ? {} : { id: ids[at]! }) })),
  }
}
