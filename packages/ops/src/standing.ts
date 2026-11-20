import {
  type KindVocabulary,
  type MovingAnswer,
  type MovingRequest,
  type NarrowingAnswer,
  type NarrowingRequest,
  type PageReading,
  type PageRequest,
  type Reading,
  sameMoving,
  sameNarrowing,
  samePageReading,
  stillHolds,
  type Tape,
  taping,
} from "@olai/format"

import * as Query from "./query.ts"

interface Question<I, A> {
  readonly answer: (
    at: Reading,
    input: I,
    now: () => string,
    kinds: KindVocabulary,
  ) => A
  readonly same: (a: A, b: A) => boolean
}

const PAGE: Question<PageRequest, PageReading> = {
  answer: (at, request, _now, kinds) => Query.page(at, request, kinds),
  same: samePageReading,
}

const NARROWING: Question<NarrowingRequest, NarrowingAnswer> = {
  answer: (at, request, now, kinds) => Query.narrowing(at, request, now(), kinds),
  same: sameNarrowing,
}

const MOVING: Question<MovingRequest, MovingAnswer> = {
  answer: (at, request) => Query.moving(at.derived, request),
  same: sameMoving,
}

const ASKED = {
  page: PAGE,
  narrowing: NARROWING,
  moving: MOVING,
} as const

export type Asked = keyof typeof ASKED

export interface Standing {
  readonly page: (at: Reading, request: PageRequest) => PageReading
  readonly narrowing: (at: Reading, request: NarrowingRequest) => NarrowingAnswer
  readonly moving: (at: Reading, request: MovingRequest) => MovingAnswer
}

interface Held {
  reading: Reading
  readonly answer: unknown
  readonly tape: Tape
  askers: number
}

export const standing = (now: () => string, kinds: KindVocabulary): Standing => {
  let at: Reading | null = null
  let live = new Map<string, Held>()
  let prior = new Map<string, Held>()

  const sharedAt = (key: string): Held | undefined => {
    const held = live.get(key)
    if (held === undefined) return undefined
    held.askers++
    return held
  }

  const carriedIfUnmoved = (key: string, reading: Reading): Held | undefined => {
    const before = prior.get(key)
    if (before === undefined || !stillHolds(before.tape, before.reading, reading)) {
      return undefined
    }
    before.reading = reading
    before.askers = 1
    live.set(key, before)
    return before
  }

  const build = <I, A>(key: string, question: Question<I, A>, reading: Reading, input: I): A => {
    const taped = taping(reading)
    const fresh = question.answer(taped.reading, input, now, kinds)
    const before = prior.get(key)
    const answer = before !== undefined && before.askers > 1 &&
        question.same(before.answer as A, fresh)
      ? before.answer as A
      : fresh
    live.set(key, { reading, answer, tape: taped.tape, askers: 1 })
    return answer
  }

  const ask = <I, A>(which: Asked, question: Question<I, A>, reading: Reading, input: I): A => {
    if (reading !== at) {
      prior = live
      live = new Map()
      at = reading
    }
    const key = `${which} ${JSON.stringify(input)}`
    const shared = sharedAt(key)
    if (shared !== undefined) return shared.answer as A
    const carried = carriedIfUnmoved(key, reading)
    if (carried !== undefined) return carried.answer as A
    return build(key, question, reading, input)
  }

  return {
    page: (reading, request) => ask("page", PAGE, reading, request),
    narrowing: (reading, request) => ask("narrowing", NARROWING, reading, request),
    moving: (reading, request) => ask("moving", MOVING, reading, request),
  }
}

export const rebuilding = (now: () => string, kinds: KindVocabulary): Standing => ({
  page: (at, request) => PAGE.answer(at, request, now, kinds),
  narrowing: (at, request) => NARROWING.answer(at, request, now, kinds),
  moving: (at, request) => MOVING.answer(at, request, now, kinds),
})

export const sameAnswer = (which: Asked, a: unknown, b: unknown): boolean =>
  (ASKED[which].same as (x: unknown, y: unknown) => boolean)(a, b)
