import { type Accessor, createEffect, createMemo, createSignal } from "solid-js"
import { debounce } from "@solid-primitives/scheduled"

import type { TagCompletion, TagsAnswer, TagsRequest } from "@olai/format"

import { SETTLE_MS, type Taking } from "@olai/web/client/settled.ts"
import { client } from "../../client.ts"

const LIMIT = 8

export type Asking = Omit<TagsRequest, "limit">

export interface Tags {
  readonly rows: Accessor<ReadonlyArray<TagCompletion>>
  readonly failure: Accessor<string | null>
  readonly taking: Taking
}

const same = (was: Asking | null, is: Asking | null): boolean =>
  was === is ||
  (was !== null && is !== null && was.sigil === is.sigil && was.query === is.query)

export const createTags = (asking: Accessor<Asking | null>): Tags => {
  const wanted = createMemo(asking, null, { equals: same })
  const [asked, setAsked] = createSignal<Asking | null>(null, { equals: same })
  const settle = debounce(setAsked, SETTLE_MS)
  createEffect(() => {
    const query = wanted()
    if (query !== null) settle(query)
    else {
      settle.clear()
      setAsked(null)
    }
  })
  const input = createMemo(() => {
    const query = asked()
    return query === null ? null : { ...query, limit: LIMIT }
  })
  const answer = client().streams.tagCompletions.use(input)
  const held = createMemo<{ query: Asking; value: TagsAnswer } | undefined>((previous) => {
    const query = asked()
    const current = wanted()
    if (current === null || query === null || answer.error() !== undefined) return undefined
    if (query.sigil !== current.sigil) return undefined
    const value = answer()
    if (value !== undefined) return { query, value }
    return previous?.query.sigil === query.sigil ? previous : undefined
  }, undefined)
  return {
    rows: () => held()?.value.tags ?? [],
    failure: () => answer.error()?.message ?? null,
    taking: (act) => {
      const got = held()
      if (got !== undefined && same(got.query, wanted())) act()
    },
  }
}
