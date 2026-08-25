/**
 * ONE HIT, as the row a door draws it as.
 *
 * A search answers with two kinds of thing now — a record and a document
 * (`@olai/format`'s `SearchHit`) — and this is where a hit becomes a row,
 * ONCE, for the reason `./Result.tsx` is one component: two spellings of "what
 * does a document hit look like" is the day the palette grows a glyph the
 * header box does not have.
 *
 * THREE DOORS of the four, and the fourth is named rather than left out. The ⌘K
 * palette, the header's box and the shortlist every node-picking panel is built
 * from all come through here. The composer's `((` widget does not, and cannot:
 * what it writes is a MIRROR, so what it needs off a hit is the raw node id,
 * where a row's id is its printed ADDRESS. It draws the same label, place and
 * properties through the same two functions this does (`./place.ts`,
 * `./props.ts`), which is the half that could drift.
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

import { type BodyKind, bodyKind, isNodeHit, printAddress, type SearchHit } from "@olai/format"

import type { NodeProp } from "./props.ts"
import { documentProps, nodeProps } from "./props.ts"
import { nodePlace } from "./place.ts"
import { atFile, atNode, type Route } from "../routes.ts"

export interface HitRow {
  /** What identifies the row: its ADDRESS, written. A node's is `#a1b2c3` and
   *  a document's is its path, so no two rows share one and the string itself
   *  says which kind it is — which is the grammar earning its keep rather than
   *  a prefix picked here. */
  readonly id: string
  readonly label: string
  /** The directory's glyph, for a row that is a FILE — absent for a record,
   *  which is not one. */
  readonly of?: BodyKind
  /** The second line: where this is. */
  readonly place: string
  /** The third line: the named facts this row carries. A record's are its
   *  `custom` map; a document's are the YAML frontmatter at the top of the
   *  file, which is the same open namespace read out of the one place a `.md`
   *  has to write one (`@olai/format`'s `frontmatter.ts`). */
  readonly props: ReadonlyArray<NodeProp>
  /** Where taking it goes. */
  readonly route: Route
  /**
   * The file the row's label's PROSE is written in — handed to `renderTitle`
   * so a markdown title in the palette or the header box is the same HTML a
   * tree row draws. Both kinds carry it now: a node's is its outline, a
   * document hit's is its own path, because a document face's title is prose
   * the format tags the same way (its tags are read off it, docs/format.md),
   * so a `#tag` there wears a pill — and its hue — like anywhere else.
   */
  readonly from?: string
}

export const hitRow = (hit: SearchHit): HitRow => {
  if (isNodeHit(hit)) {
    return {
      id: printAddress(hit.at),
      label: hit.title,
      from: hit.file,
      place: nodePlace(hit),
      props: nodeProps(hit),
      route: atNode(hit.id),
    }
  }
  const path = hit.at.path
  // The GLYPH is the only thing here that asks which kind of file this is: the
  // route is the address and nothing more, and which page it opens is the page
  // model's one question (`../page.ts`).
  const of: BodyKind = bodyKind(path) ?? "document"
  return {
    id: printAddress(hit.at),
    label: hit.title,
    of,
    // THE PATH, because that is where a document is. A node's place is the
    // trail of titles above it; a document hangs under nothing, and the honest
    // answer to "where is this" is the file it is.
    place: path,
    // ...and the label renders LIKE A NODE'S: a document face's title is prose
    // the format tags (`@olai/format`'s document face), so a `#tag` in it is
    // styled — and coloured — exactly as it is on every other search row, and
    // the query's words light in it where they sit.
    from: path,
    props: documentProps(hit),
    route: atFile(path),
  }
}
