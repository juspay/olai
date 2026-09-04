/**
 * Which record a day entry is, as a place key.
 *
 * A day crosses the whole set, and `parent` never crosses a file, so the
 * file/id pair names one record wherever it was written. Used both for
 * `<Key>` identity and for note-expand, the same way `Row.key` names a place
 * in a tree.
 */

import type { Situated } from "@olai/format"

export const placeOf = (dated: Situated): string =>
  `${dated.shows.file}/${dated.shows.node.id}`
