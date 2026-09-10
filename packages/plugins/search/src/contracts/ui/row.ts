import { isNodeHit, printAddress, type SearchHit } from "@olai/format"

import type { NodeProp } from "olai-plugin-search/ui/props.ts"
import { documentProps, nodeProps } from "olai-plugin-search/ui/props.ts"
import { nodePlace, type Place } from "olai-plugin-search/ui/place.ts"
import { atFile, atNode, lineFragment, type Route } from "olai-plugin-navigation/routes"

export interface HitRow {
  /** What identifies the row: its ADDRESS, written. A node's is `#a1b2c3` and
   *  a document's is its path, so no two rows share one and the string itself
   *  says which kind it is — which is the grammar earning its keep rather than
   *  a prefix picked here. */
  readonly id: string
  readonly label: string
  /** The file and ancestor parts on the second line. */
  readonly place: Place
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

export const hitRow = (hit: SearchHit, query?: string): HitRow => {
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
  return {
    id: printAddress(hit.at),
    label: hit.title,
    // THE PATH, because that is where a document is. A node's place is the
    // trail of titles above it; a document hangs under nothing, and the honest
    // answer to "where is this" is the file it is.
    place: { file: path },
    // ...and the label renders LIKE A NODE'S: a document face's title is prose
    // the format tags (`@olai/format`'s document face), so a `#tag` in it is
    // styled — and coloured — exactly as it is on every other search row, and
    // the query's words light in it where they sit.
    from: path,
    props: documentProps(hit),
    route: atFile(path, hit.line === undefined ? undefined : lineFragment(hit.line), query),
  }
}
