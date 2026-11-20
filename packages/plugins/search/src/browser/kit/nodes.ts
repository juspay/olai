import { debounce } from "@solid-primitives/scheduled"
import { createKeyedRoot } from "@kolu/surface/solid"
import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js"

import type { NodeHit, Refusal, SearchAnswer, SearchHit } from "@olai/format"

import { SETTLE_MS, type Taking } from "@olai/web/client/settled.ts"
import { client } from "../../client.ts"
import { LIMIT, type Search, type SearchKind, type SearchProvider } from "../../contracts/reading.ts"

const MIN_LENGTH = 3

type Question = { readonly query: string; readonly kind: SearchKind }

interface Answered {
  readonly question: Question
  readonly value: SearchAnswer
}

const sameQuestion = (a: Question | null | undefined, b: Question | null | undefined): boolean =>
  a?.query === b?.query && a?.kind === b?.kind

export const freshProvider = (): SearchProvider => (text, kind) => createSearch(text, kind)

export function createSearch(
  text: Accessor<string | null>,
  kind?: Accessor<SearchKind>,
): Search {
  const wanted = createMemo<Question | null>(() => {
    const query = text()?.trim() ?? ""
    return query.length >= MIN_LENGTH ? { query, kind: kind?.() } : null
  }, null, { equals: sameQuestion })
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
  const asking = createKeyedRoot(asked, (question) => ({
    question,
    answer: client().streams.searchResults.use(() => question === null ? null : {
      text: question.query, limit: LIMIT, ...(question.kind === undefined ? {} : { kind: question.kind }),
    }),
  }))
  const held = createMemo<Answered | undefined>((previous) => {
    const { question, answer } = asking()
    if (wanted() === null || question === null || answer.error() !== undefined) return undefined
    const value = answer()
    return value === undefined ? previous : { question, value }
  }, undefined, { equals: (a, b) => a?.question === b?.question && a?.value === b?.value })
  const answering = () => {
    const got = held()
    return got !== undefined && sameQuestion(got.question, wanted()) ? got.question.query : null
  }
  return {
    hits: () => held()?.value.hits ?? [],
    total: () => held()?.value.total ?? 0,
    totals: () => held()?.value.totals,
    failure: () => asking().answer.error()?.message ?? null,
    refusals: () => held()?.value.refusals ?? [],
    answering,
    taking: (act) => { if (answering() !== null) act() },
  }
}
