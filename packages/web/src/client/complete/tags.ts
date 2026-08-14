/**
 * The tags the loaded set already uses, and which of them a prefix means.
 *
 * ## Why this is not asked of the server, when node search is
 *
 * The `((` widget next door searches through the server's own procedure, and
 * `../search/nodes.ts` argues at length that a browser must not grow a second
 * matcher: what the ⌘K palette finds and what an agent's `search_nodes` finds
 * have to be one reading. That argument is about RANKING — a query language, a
 * score, four weighted fields — and none of it is here.
 *
 * What is here is an ENUMERATION: every tag written in a title of the set this
 * tab is holding, counted, filtered by prefix. The walk is the format's own
 * (`titleParts`, the same call that draws the pills a row already shows), the
 * set is the one the page is drawing, and there is no ordering question a
 * server could answer differently. Asking the wire for it would put a round
 * trip and a debounce inside a completion that has to keep up with typing, to
 * re-derive a fact this tab is already holding — and it would need a procedure
 * MCP has no equivalent of, which is a parity question this feature does not
 * have to open.
 *
 * If a tag facet ever becomes a REPORT — "every tag, most used first, across a
 * corpus this tab does not hold" — that is a reading, it belongs on both faces,
 * and this file becomes its caller. Recorded rather than pre-built.
 *
 * ## The two sigils are two lists
 *
 * `#alice` and `@alice` are different tags (`@olai/format`'s `TAG_SIGILS`), so
 * typing `@` offers what has been written with an `@` and typing `#` offers
 * what has been written with a `#`. Offering one namespace's names under the
 * other's sigil would be the widget inventing tags the set does not hold.
 */

import { type Derived, isMirror, type TagSigil, titleParts } from "@olai/format"

/** One tag of the set, and how much of it there is. */
export interface Tag {
  readonly sigil: TagSigil
  /** The name, without the sigil. */
  readonly name: string
  /** How many nodes carry it — what orders the list, because the tag somebody
   *  means is usually the tag they have used before. */
  readonly count: number
}

/** How many rows the widget offers. A row's popup is a shortlist. */
const LIMIT = 8

/**
 * Every tag in the set, most-used first and alphabetical within a count.
 *
 * MIRRORS ARE SKIPPED, which is the same rule every other reading of the set
 * follows: a placement has no title of its own, so a tag counted through one
 * would be the same node's tag counted twice.
 *
 * Derived per call and memoised by the caller against the live indexes, so a
 * tag that arrives on disk is offered without a reload.
 */
export const tagsOf = (derived: Derived | undefined): ReadonlyArray<Tag> => {
  if (derived === undefined) return []
  const counts = new Map<string, Tag>()
  for (const located of derived.nodes) {
    if (isMirror(located.node)) continue
    for (const part of titleParts(located.node.title)) {
      if (part.kind !== "tag") continue
      const key = `${part.sigil}${part.tag}`
      const seen = counts.get(key)
      counts.set(
        key,
        seen === undefined
          ? { sigil: part.sigil, name: part.tag, count: 1 }
          : { ...seen, count: seen.count + 1 },
      )
    }
  }
  return [...counts.values()].sort((a, b) =>
    b.count - a.count || a.name.localeCompare(b.name)
  )
}

/**
 * The tags of one sigil that `query` could be the start of, best first.
 *
 * A PREFIX first and a substring second, folded for case: typing `ho` puts
 * `#home` above `#household-of` and both above `#new-home`. That order is the
 * one property this needs — the tag somebody is typing towards is nearly always
 * one they have started spelling — and it is deliberately not a score.
 *
 * An EMPTY query answers with the whole list (capped), which is what makes a
 * bare `#` a way of seeing what this set even uses.
 */
export const matchTags = (
  tags: ReadonlyArray<Tag>,
  sigil: TagSigil,
  query: string,
): ReadonlyArray<Tag> => {
  const wanted = query.toLowerCase()
  const mine = tags.filter((tag) => tag.sigil === sigil)
  if (wanted === "") return mine.slice(0, LIMIT)
  const starts = mine.filter((tag) => tag.name.toLowerCase().startsWith(wanted))
  const inside = mine.filter((tag) =>
    !tag.name.toLowerCase().startsWith(wanted) && tag.name.toLowerCase().includes(wanted)
  )
  return [...starts, ...inside].slice(0, LIMIT)
}
