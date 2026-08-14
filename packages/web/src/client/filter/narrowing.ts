/**
 * The page's filter, as one reading.
 *
 * Everything a filtered page needs is derived from ONE string — the `?q=` on
 * the address (`../routes.ts`) — and it is derived here rather than in the
 * components, so the bar's count, the rows the tree draws and the folds it
 * suspends cannot come to three different conclusions about the same query.
 *
 * THE MATCHING IS NOT HERE. `@olai/format`'s `parseFilter` / `matching` is what
 * decides which nodes a query selects, and it is the same function an agent's
 * `search_nodes` is gated by — one matcher, four callers, argued in that file's
 * header and in docs/brainstorming/filter-in-place.md. This file decides only
 * what to do with the answer.
 *
 * The ORDER of the two prunings is the decision worth naming: done-hidden goes
 * FIRST. It is a standing claim about the reader ("I do not want to look at
 * finished work"); the filter is a question about the page. So the filter reads
 * what the preference left, and `is:done` under a done-hiding preference draws
 * nothing — which is said out loud ({@link Narrowing.hiddenAsDone}) rather than
 * special-cased away. Letting an explicit `is:done` override the preference
 * would make the preference mean two things depending on what else was typed.
 */

import type { Derived, Filter, Refusal, Row } from "@olai/format"
import { keeping, matchedIn, matching, parseFilter } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

/** What an unfiltered page has selected — ONE set, shared by every reading of
 *  it. A fresh `new Set()` per read would be a new value every frame, and every
 *  row of the tree memoises against this one. */
export const NOTHING_MATCHED: ReadonlySet<string> = new Set()

/** What a filtered page knows about itself. */
export interface Narrowing {
  /** What was typed, verbatim — the value in the box. */
  readonly text: Accessor<string>
  /** Is there a filter at all? An empty box is not a filter; a box holding a
   *  query the grammar refused IS one, and it selects nothing. */
  readonly active: Accessor<boolean>
  /** What the grammar could not read, in its own words — empty for every query
   *  it could. Lifted off the parsed value rather than handed out with it: the
   *  bar wants the sentences, and nothing in this client has any business
   *  reading a query's terms apart from the matcher that owns them. */
  readonly refusals: Accessor<ReadonlyArray<Refusal>>
  /** The node ids the query selects, across the whole set. Tested against the
   *  rows the page draws, which is what scopes it to the page. */
  readonly matched: Accessor<ReadonlySet<string>>
  /** The rows the page actually draws: done-hidden first, then narrowed. */
  readonly rows: Accessor<ReadonlyArray<Row>>
  /** How many drawn rows are matches, and how many rows there are in all —
   *  "3 of 41", the honest version. Both are PLACES: a node drawn twice is two
   *  rows, and the reader is counting rows. */
  readonly shown: Accessor<number>
  readonly total: Accessor<number>
  /** Matches the done-preference is holding back. Zero unless finished work is
   *  hidden, and the reason `is:done` looking empty is a sentence rather than a
   *  mystery. */
  readonly hiddenAsDone: Accessor<number>
}

/**
 * The reading, over the app's three inputs: the set's derivation, the rows the
 * open page draws BEFORE the done preference is applied, and the same rows
 * after it.
 *
 * Both row lists are handed in rather than computed here because the app
 * already has them (`../App.tsx` composes the page and applies `visible`), and
 * a second `rowsFor` would be a second answer to what page is open.
 */
export const createNarrowing = (source: {
  readonly derived: Accessor<Derived | undefined>
  readonly text: Accessor<string>
  /** The page's rows with nothing hidden — what the count of held-back
   *  matches is measured against. */
  readonly all: Accessor<ReadonlyArray<Row>>
  /** The same rows with this reader's preference applied. */
  readonly visible: Accessor<ReadonlyArray<Row>>
}): Narrowing => {
  const query = createMemo(() => parseFilter(source.text()))
  const active = createMemo(() => query().kind !== "nothing")

  const matched = createMemo(() => {
    const indexes = source.derived()
    if (indexes === undefined || !active()) return NOTHING_MATCHED
    return new Set(matching(indexes, query()).map(({ at }) => at.node.id))
  })

  // The ONE guard that is load-bearing: `keeping` over an empty set is an empty
  // tree, and an unfiltered page draws the whole one. Every count below is
  // honestly zero without a guard, so none of them has one.
  const rows = createMemo(() =>
    active() ? keeping(source.visible(), matched()) : source.visible()
  )

  const shown = createMemo(() => matchedIn(rows(), matched()))

  return {
    text: source.text,
    active,
    refusals: createMemo(() => {
      const asked = query()
      return asked.kind === "refused" ? asked.refusals : []
    }),
    matched,
    rows,
    shown,
    // Only ever READ beside the count, which is drawn only while a filter is
    // on — so an unfiltered page does not pay a walk of its whole tree, on
    // every revision the store publishes, for a number nobody is looking at.
    total: createMemo(() => (active() ? countRows(source.visible()) : 0)),
    // The difference between what the query selects on this page and what
    // survived the preference. Measured over the page's own rows rather than
    // over the set, because "4 done matches are hidden" is a claim about what
    // is not on this screen.
    //
    // The identity check is exact rather than an optimisation that hopes: the
    // done preference returns THE SAME ARRAY when it is hiding nothing
    // (`../settings/done.ts`), so two identical lists cannot differ by a match.
    hiddenAsDone: createMemo(() =>
      source.all() === source.visible()
        ? 0
        : matchedIn(source.all(), matched()) - shown()
    ),
  }
}

const countRows = (rows: ReadonlyArray<Row>): number =>
  rows.reduce((total, row) => total + 1 + countRows(row.children), 0)
