/**
 * Which places under a row can fold — the keys a "collapse all" / "expand all"
 * menu action names.
 *
 * Lives beside the tree rather than inside the menu: the walk is about Row
 * shape, and the menu is about presenting verbs. Both expand-all and
 * collapse-all ask the same question ("every place under here that has
 * children"), so the answer is one function.
 */

import type { Row } from "@olai/format"

/** Every key under `row` (including `row` itself) that currently has children
 *  to hide or show. Leaves are skipped: there is nothing for a fold to do. */
export const foldableKeys = (row: Row): ReadonlyArray<string> => {
  const out: string[] = []
  const walk = (here: Row): void => {
    if (here.children.length > 0) out.push(here.key)
    for (const child of here.children) walk(child)
  }
  walk(row)
  return out
}
