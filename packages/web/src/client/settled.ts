import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import {
  type Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  untrack,
} from "solid-js"

import { type Call, runAsync } from "@olai/web/client/run.ts"

export const SETTLE_MS = 200

export type Taking = (act: () => void) => void

export const atOnce: Taking = (act) => act()

export const spend = <R extends { readonly taking: Taking }>(
  row: R | undefined,
  act: (row: R) => void,
): void => {
  if (row === undefined) return
  row.taking(() => act(row))
}

export interface Settled<Q, A> {
  readonly answer: Accessor<A | undefined>
  readonly answering: Accessor<Q | null>
  readonly taking: Taking
  readonly failure: Accessor<string | null>
}

export const createSettled = <Q, A>(
  question: Accessor<Q | null>,
  ask: (question: Q) => Call<A>,
  equals?: (was: Q | null, is: Q | null) => boolean,
): Settled<Q, A> => {
  const same = equals ?? Object.is
  const [failure, setFailure] = createSignal<string | null>(null)
  const [asked, setAsked] = createSignal<Q | null>(null, { equals: same })
  const put = (next: Q | null) => setAsked(() => next)
  const settle = debounce(put, SETTLE_MS)

  const wanted = createMemo<Q | null>(question, null, { equals: same })

  const current = (one: Q) => same(untrack(asked), one)

  const [answer, { mutate }] = createResource(asked, async (one: Q) => {
    const outcome = await runAsync(ask(one))
    if (Result.isFailure(outcome)) {
      if (current(one)) setFailure(outcome.failure.message)
      return undefined
    }
    if (current(one)) setFailure(null)
    return { question: one, answer: outcome.success }
  })

  const forget = () => mutate(() => undefined)

  createEffect(() => {
    const asking = wanted()
    if (asking !== null) {
      settle(asking)
      return
    }
    settle.clear()
    put(null)
    setFailure(null)
    forget()
  })

  const answering = (): Q | null => {
    const got = answer()
    return got !== undefined && same(got.question, wanted()) ? got.question : null
  }

  return {
    answer: () => answer()?.answer,
    answering,
    taking: (act) => {
      if (answering() !== null) act()
    },
    failure,
  }
}
