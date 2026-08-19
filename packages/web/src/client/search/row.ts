/**
 * ONE HIT, as the row a door draws it as.
 *
 * A search answers with two kinds of thing now — a record and a document
 * (`@olai/format`'s `SearchHit`) — and four surfaces draw the answer: the ⌘K
 * palette, the header's box, the `((` widget in a row's title and the edge
 * panel. This is where a hit becomes a row, ONCE, for the reason `./Result.tsx`
 * is one component: two spellings of "what does a document hit look like" is
 * the day the palette grows a glyph the header box does not have.
 *
 * WHAT A ROW NEEDS is small and the same for both kinds — a label, somewhere it
 * is, and where taking it goes — and what differs is where each of those comes
 * from. A node's label is its title and its place is the trail of ancestors
 * above it; a document's label is its own face's title and its place is the
 * path, because a document has no ancestors and inventing some would be the
 * node-shaped lie this arc exists to stop.
 *
 * THE GLYPH is the one thing a document row has that a node row does not, and
 * it is the sidebar's own (`../file/icons.tsx`) rather than one invented here:
 * a `.md` in a list of strangers has to look like the `.md` in the tree, or a
 * reader is learning the directory twice.
 */

import { type BodyKind, bodyKind, isNodeHit, type SearchHit } from "@olai/format"

import { routeTo } from "../file/kinds.ts"
import type { NodeProp } from "./props.ts"
import { nodeProps } from "./props.ts"
import { nodePlace } from "./place.ts"
import type { Route } from "../routes.ts"

export interface HitRow {
  /** What identifies the row to a test and to a keyed list — an id for a
   *  record, a path for a document, and never the same string for two rows
   *  because no node id is a served path. */
  readonly id: string
  readonly label: string
  /** The directory's glyph, for a row that is a FILE — absent for a record,
   *  which is not one. */
  readonly of?: BodyKind
  /** The second line: where this is. */
  readonly place: string
  /** The third line, for a record carrying properties. A document carries
   *  none — there is nowhere on a `.md` to write one, which is the hole
   *  frontmatter fills. */
  readonly props: ReadonlyArray<NodeProp>
  /** Where taking it goes. */
  readonly route: Route
}

export const hitRow = (hit: SearchHit): HitRow => {
  if (isNodeHit(hit)) {
    return {
      id: hit.id,
      label: hit.title,
      place: nodePlace(hit),
      props: nodeProps(hit),
      route: { kind: "node", id: hit.id },
    }
  }
  const path = hit.at.path
  // The suffix is what says which page a path opens, which is the whole reason
  // the address grammar needs one (`@olai/format`'s `address.ts`) — so the
  // route is the registry's answer rather than a second reading of the name.
  const of: BodyKind = bodyKind(path) ?? "document"
  return {
    id: path,
    label: hit.title,
    of,
    // THE PATH, because that is where a document is. A node's place is the
    // trail of titles above it; a document hangs under nothing, and the honest
    // answer to "where is this" is the file it is.
    place: path,
    props: [],
    route: routeTo(of, path),
  }
}
