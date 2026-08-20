/**
 * WHAT A REFUSED QUERY SAYS, as the lines a live region announces.
 *
 * Three surfaces draw the same list — the filter bar over the page
 * (`./filter/FilterBar.tsx`), the ⌘K palette and the header's box (both over
 * `./search/nodes.ts`) — and each of them announces it: `role="alert"` with
 * `aria-live="assertive"`, because a reader who does not notice a refused
 * operator believes the directory is empty. The sentence was spelled at all
 * three, which is the shape this repo already calls a drift waiting to happen.
 *
 * STRINGS, and that is the reactivity half rather than a tidy-up. Every parse
 * of the box mints fresh `Refusal` objects — per keystroke for the filter bar
 * (`./filter/narrowing.ts`), per answer for the two search doors — so a list
 * drawn by identity was a list rebuilt for a query that had not changed its
 * mind, and a rebuilt `role="alert"` is the same sentence read out loud again.
 * A memo over the sentences is compared BY VALUE: an identical refusal returns
 * an equal string, `<Index>` writes nothing, and nothing is announced twice.
 *
 * `<Index>` rather than `<Key>` at the sites, for the reason `../search/
 * Shortlist.tsx` gives about hits: these lines are positional and there are a
 * handful of them — and a token can be refused twice in one query (`is:OPEN
 * is:OPEN`), so the token is not a key.
 */

import type { Refusal } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

/** One refusal, as the sentence a surface draws: the token AS TYPED, and why —
 *  the em-dashed pair every door has always used. */
const said = (refusal: Refusal): string =>
  `${refusal.token} — ${refusal.reason}`

/** The whole list of them, memoised so an unchanged refusal is an unchanged
 *  string — see the header. */
export const refusalLines = (
  refusals: Accessor<ReadonlyArray<Refusal>>,
): Accessor<ReadonlyArray<string>> => createMemo(() => refusals().map(said))
