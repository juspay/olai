/**
 * WHERE a hit sits, as the second line of {@link ./Result.tsx} says it: the
 * ancestry innermost first, or the file for a node at top level.
 *
 * Beside the row it is drawn on rather than in `palette/`, where it began: it
 * is a fact about a SEARCH HIT, and all four doors onto the one search draw
 * it — the ⌘K palette, the header's box, the `((` widget in a row's title and
 * the edge panel. Two spellings of it would be two answers to "which `install
 * them`?" in four places looking at the same set.
 *
 * NEAREST ANCESTOR FIRST, which is not the order the path is stored in, and it
 * is two reasons that are the same reason twice: the nearest ancestor is what
 * actually situates a node, and a line that must be ellipsized loses its END,
 * so the crumb that matters has to be at the front to survive a narrow panel.
 * The outer crumbs follow while there is room.
 *
 * Its own module rather than an export of the component, so a pure unit test of
 * a caller does not have to compile a `.tsx` to reach it.
 *
 * IT TAKES THE TWO FIELDS IT READS rather than a whole hit, and that is what
 * lets a FOURTH caller in that never asked the server anything: the chat
 * composer's `@` list situates a node out of the set the tab is already holding
 * (`../chat/nodes.ts`), and a signature spelled `SearchHit` would have made it
 * mint a fake one — a shape with an id, a title and a status in it, invented to
 * satisfy a function that reads none of them.
 */

import { ancestorTitles, type Derived, type LocatedRegular } from "@olai/format"
import type { SearchHit } from "@olai/surface"

export const nodePlace = (hit: Pick<SearchHit, "file" | "path">): string =>
  hit.path.length === 0 ? hit.file : [...hit.path].reverse().join(" · ")

/**
 * The same sentence for a caller holding a RECORD rather than a hit — the
 * ancestry walk and the formatting above, joined.
 *
 * The pairing was written out at every such call site (`../chat/nodes.ts`'s
 * `@` list, the graph's dots), which is the half this module's header did not
 * cover: it extracted the FORMATTING, and left "which ancestors get situated"
 * to be spelled again per reader. `@olai/ops`' `foundOf` is a fourth reader and
 * cannot import this one — it is a different package, and its own comment
 * already names itself the third — so what this collapses is the two that can
 * share.
 */
export const placeOf = (derived: Derived, at: LocatedRegular): string =>
  nodePlace({ file: at.file, path: ancestorTitles(derived, at.node.id) })
