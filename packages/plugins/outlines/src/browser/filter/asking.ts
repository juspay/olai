import { debounce } from "@solid-primitives/scheduled"
import { type Accessor, createEffect, createMemo, createSignal } from "solid-js"

import type { Filter, NarrowingAnswer, NarrowingRequest, PageRequest } from "@olai/format"
import { sameNarrowingRequest } from "@olai/format"
import type { MatchedNode } from "@olai/format"

import { SETTLE_MS } from "@olai/web/client/settled.ts"
import { client } from "../../client.ts"
import type { Matches } from "./matches.ts"

type Standing =
  | { readonly kind: "none" }
  | { readonly kind: "waiting"; readonly stood: Answered | undefined }
  | { readonly kind: "answered"; readonly answer: Answered }
  | { readonly kind: "failed"; readonly because: string }

const NOTHING_ASKED: Standing = { kind: "none" }

interface Answered {
  readonly about: PageRequest
  readonly answer: NarrowingAnswer
}

export interface Asked {
  readonly matched: Accessor<Matches | undefined>
  readonly answering: Accessor<string | null>
  readonly failure: Accessor<string | null>
  readonly about: Accessor<PageRequest | null>
  readonly awaiting: Accessor<boolean>
}

export const createAsked = (source: {
  readonly query: Accessor<Filter>
  readonly text: Accessor<string>
  readonly page: Accessor<PageRequest | null>
  readonly opened: Accessor<unknown>
}): Asked => {
  const [asked, setAsked] = createSignal<string | null>(null)
  const settle = debounce(setAsked, SETTLE_MS)

  const question = createMemo(() =>
    source.query().kind === "asking" ? source.text().trim() : null
  )

  createEffect<unknown>((was) => {
    const wanted = question()
    const here = source.opened()
    if (wanted === null) {
      settle.clear()
      setAsked(null)
    } else if (here !== was) {
      settle.clear()
      setAsked(wanted)
    } else {
      settle(wanted)
    }
    return here
  }, undefined)

  const asking = createMemo<NarrowingRequest | null>(
    () => {
      const text = asked()
      const page = source.page()
      return text === null || page === null ? null : { page, text }
    },
    null,
    {
      equals: (was, is) =>
        was === is ||
        (was !== null && is !== null && sameNarrowingRequest(was, is)),
    },
  )

  const answer = client().streams.narrowing.use(asking)

  const stood = createMemo<Answered | undefined>((was) => {
    const question = asking()
    if (question === null) return undefined
    const arrived = answer()
    return arrived === undefined ? was : { about: question.page, answer: arrived }
  }, undefined)

  const standing = createMemo<Standing>(() => {
    const question = asking()
    if (question === null) return NOTHING_ASKED
    const failed = answer.error()
    if (failed !== undefined) return { kind: "failed", because: failed.message }
    const arrived = answer()
    return arrived === undefined
      ? { kind: "waiting", stood: stood() }
      : { kind: "answered", answer: { about: question.page, answer: arrived } }
  })

  const showing = (): Answered | undefined => {
    const at = standing()
    switch (at.kind) {
      case "answered":
        return at.answer
      case "waiting":
        return at.stood
      case "none":
      case "failed":
        return undefined
    }
  }

  const matched = createMemo<Matches | undefined>(() => {
    const answered = showing()
    if (answered === undefined) return undefined
    const matches = new Map<string, MatchedNode>()
    for (const one of answered.answer.matches) matches.set(one.id, one)
    return matches
  })

  return {
    matched,
    answering: () => showing()?.answer.text ?? null,
    about: () => showing()?.about ?? null,
    failure: () => {
      const at = standing()
      if (at.kind !== "failed" || question() !== asked()) return null
      return at.because
    },
    awaiting: () => standing().kind === "waiting",
  }
}
