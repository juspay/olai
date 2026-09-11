/**
 * Search shared by the palette, header and node pickers. Queries debounce,
 * then subscribe to server-side matching until the input is cleared. Vault
 * revisions refresh hits and totals without another keystroke.
 *
 * Keep the previous query’s rows during a new request, labelled with the query
 * they answer so Enter cannot spend them as the new answer. Closing or
 * clearing the search discards that history and releases the subscription.
 */

import { debounce } from "@solid-primitives/scheduled"
import { createKeyedRoot } from "@kolu/surface/solid"
import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js"

import type { NodeHit, Refusal, SearchAnswer, SearchHit } from "@olai/format"

import { SETTLE_MS, type Taking } from "@olai/web/client/settled.ts"
import { client } from "../../client.ts"

/** Below this the answer is noise: two characters match half an outline by
 *  substring. The shell items still filter locally, so the palette is never
 *  blank while somebody types. */
const MIN_LENGTH = 3

/** How many nodes a DOOR of this shows — every one of them, which is what
 *  makes it a constant here rather than an argument. EXPORTED for the one
 *  caller that has to SHARE the answer with something else: the composer's
 *  `@` list draws these rows beside its file rows and budgets the eight
 *  between them (`../chat/naming.ts`), so a cap changed here without that
 *  arithmetic hearing about it would hand the file half rows the node half
 *  was still using. Fewer than the tool's
 *  twelve: each of these is a shortlist over a page a reader is standing on
 *  (a modal, a box in the header, a panel under a row), not a report. */
import { LIMIT, type Search, type SearchKind } from "../../contracts/reading.ts"


/**
 * Search as `text` changes. `null` is "not searching" — the palette is shut,
 * or the query is an ask, or it is too short to mean anything — and answers
 * with no hits rather than with the list from before.
 */
export function createSearch(
  text: Accessor<string | null>,
  /** ONE KIND, for a door that can only use one — the edge panel writing a
   *  `see`, the move picker, the composer's `@` list. It rides on the REQUEST
   *  rather than being filtered out of the answer, because the cap is applied
   *  server-side: a door that filtered afterwards would run short exactly when
   *  a query matched enough documents to fill it (`@olai/format`'s
   *  `SearchRequest`). Absent is both, which is what a reading door wants. */
  kind?: Accessor<SearchKind>,
): Search {
  type Question = { readonly query: string; readonly kind: SearchKind }
  const wanted = createMemo<Question | null>(() => {
    const query = text()?.trim() ?? ""
    return query.length >= MIN_LENGTH ? { query, kind: kind?.() } : null
  }, null, { equals: (a, b) => a?.query === b?.query && a?.kind === b?.kind })
  const [asked, setAsked] = createSignal<Question | null>(null)
  const settle = debounce(setAsked, SETTLE_MS)
  onCleanup(() => settle.clear())
  createEffect(() => {
    const query = wanted()
    if (query !== null) settle(query)
    else {
      settle.clear()
      setAsked(null)
    }
  })
  // A response belongs to the query that opened its subscription. The stream
  // hook resets a reactive input in an effect; a memo can otherwise observe
  // the new query alongside the old value before that effect runs, relabeling
  // retained rows and briefly authorizing Enter on the wrong node.
  const reading = createKeyedRoot(asked, (question) => ({
    question,
    answer: client().streams.searchResults.use(() => question === null ? null : {
      text: question.query, limit: LIMIT, ...(question.kind === undefined ? {} : { kind: question.kind }),
    }),
  }))
  // Hold the prior query's rows during a new request, but never across closing
  // the search or a refused subscription. The label gates keyboard result gestures.
  const held = createMemo<{ question: Question; value: SearchAnswer } | undefined>((previous) => {
    const { question, answer } = reading()
    if (wanted() === null || question === null || answer.error() !== undefined) return undefined
    const value = answer()
    return value === undefined ? previous : { question, value }
  }, undefined)
  const answering = () => {
    const got = held()
    return got !== undefined && got.question.query === wanted()?.query && got.question.kind === wanted()?.kind ? got.question.query : null
  }
  return {
    hits: () => held()?.value.hits ?? [],
    total: () => held()?.value.total ?? 0,
    totals: () => held()?.value.totals,
    failure: () => reading().answer.error()?.message ?? null,
    refusals: () => held()?.value.refusals ?? [],
    answering,
    taking: (act) => { if (answering() !== null) act() },
  }
}
