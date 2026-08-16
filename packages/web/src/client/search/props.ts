/**
 * WHICH properties a hit shows, and in what order — the third line of
 * {@link ./Result.tsx}.
 *
 * Beside the row rather than in `palette/`, for the reason `./place.ts` is and
 * word for word: it is a fact about a SEARCH HIT, every door onto the one
 * search draws it, and two spellings of it would be two answers to "what does
 * this node say about itself" in the same panel. Its own module rather than an
 * export of the component, so a unit test of the ordering does not have to
 * compile a `.tsx`.
 *
 * Named to match that sibling — `nodeProps` beside `nodePlace`, both taking a
 * hit and answering what a row draws about the node it stands for. It was
 * `hitProps`, which is the same job under a second vocabulary, in the file
 * directly next to the one that had already chosen the first.
 *
 * ALL FOUR DOORS reach it, and that took a correction: the ⌘K palette and the
 * header box had it while the `((` widget and the edge panel did not, over the
 * same `createNodeSearch` answers. A row that says different things in
 * different doors is the drift the one-reading doctrine exists to refuse, and
 * it is drift the shared component cannot prevent on its own — only what each
 * door passes can.
 *
 * ## Why the row draws them at all
 *
 * PR #192 put the whole `custom` map on a hit and deliberately left the row
 * alone, because "should a reader SEE a hit's properties" was a product
 * question nobody had ruled. It is ruled now, and yes: a lane board asking
 * `prop:agent=claude-opus` is a person's question as much as an agent's, and a
 * row that answered it with a bare title made the reader open each hit to find
 * the fact they had just searched by.
 *
 * ## Matched first, and that is the whole of the ordering
 *
 * The keys a `prop:` clause selected this node on lead, in the order the query
 * named them; the rest follow in the FILE's own order, which is alphabetical
 * (`customEntries`). So `prop:agent=claude-opus` puts `agent` at the front of
 * every row, where a line that has to be ellipsized still shows it — the same
 * argument `./place.ts` makes for putting the nearest ancestor first, and for
 * the same reason: what survives a narrow panel is the front.
 *
 * A query that named no property leaves every key where the file has it. There
 * is no second sort — "most interesting property" is not a fact this app has,
 * and inventing a ranking would be inventing an answer.
 *
 * WHICH keys matched is the SERVER's (`matchedProps`), not re-derived here from
 * the query text. The browser holds `parseFilter` and could read the clauses
 * itself, and that is exactly the second implementation the search doctrine
 * forbids: folding, and negation in particular, would have to be re-decided —
 * a node selected by `-prop:agent` was not selected ON `agent`, and a row that
 * highlighted it would be drawing a lie the matcher never told.
 */

import type { SearchHit } from "@olai/surface"

import { customEntries } from "../props/drawer.ts"

/** One property as the row draws it: what the drawer's line holds, plus
 *  whether it is why this hit is on screen. */
export interface NodeProp {
  readonly key: string
  readonly value: string
  /** Selected on by a `prop:` clause — drawn in the reading ink rather than the
   *  muted one, so the eye lands on the answer to "why is this here". */
  readonly matched: boolean
}

export const nodeProps = (hit: SearchHit): ReadonlyArray<NodeProp> => {
  const matched = hit.matchedProps ?? []
  const entries = customEntries(hit).map((entry) => ({
    key: entry.key,
    value: entry.value,
    matched: matched.includes(entry.key),
  }))
  // A stable partition rather than a sort: within each half the order is
  // already the one that half wants — the query's for the matched keys, the
  // file's for the rest — and a comparator would have to invent a tie-break
  // between two keys that are equally the reason.
  //
  // `find`, because a key names AT MOST ONE entry (`customEntries` is keyed by
  // the map's own keys) and the lead half is a lookup per named key, not a
  // filter that happens to return one. A key the node does not carry drops out
  // — the server names only keys it matched, and this is the row declining to
  // invent a line if that ever stops being true.
  return [
    ...matched.flatMap((key) => {
      const entry = entries.find((one) => one.key === key)
      return entry === undefined ? [] : [entry]
    }),
    ...entries.filter((entry) => !entry.matched),
  ]
}
