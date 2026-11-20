import { debounce } from "@solid-primitives/scheduled"
import { createKeyedRoot } from "@kolu/surface/solid"
import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js"

import type { NodeHit, Refusal, SearchAnswer, SearchHit } from "@olai/format"

import { SETTLE_MS, type Taking } from "@olai/web/client/settled.ts"
import { client } from "../../client.ts"

const MIN_LENGTH = 3

import { LIMIT, type Search, type SearchKind } from "../../contracts/reading.ts"


export function createSearch(
  text: Accessor<string | null>,
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
  // The stream hook resets a reactive input in an effect, so a memo can observe
  // the new query alongside the old value before that effect runs.
  const reading = createKeyedRoot(asked, (question) => ({
    question,
    answer: client().streams.searchResults.use(() => question === null ? null : {
      text: question.query, limit: LIMIT, ...(question.kind === undefined ? {} : { kind: question.kind }),
    }),
  }))
  const held = createMemo<{ question: Question; value: SearchAnswer } | undefined>((previous) => {
    const { question, answer } = reading()
    if (wanted() === null || question === null || answer.error() !== undefined) return undefined
    const value = answer()
    return value === undefined ? previous : { question, value }
  }, undefined, { equals: (a, b) => a?.question === b?.question && a?.value === b?.value })
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
